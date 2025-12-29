import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import rateLimit from 'express-rate-limit';

import {
  InvoiceIngestionRequest,
  InvoiceData,
  BatchInvoiceRequest,
  BatchInvoiceResponse,
  InvoiceValidationResult
} from '../types/invoice.types';
import { ApiResponse } from '../types/api.types';
import { ValidationError, ConflictError, NotFoundError } from '../types/common.types';
import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';
import { RedisService } from '../services/RedisService';
import { AuthRequest } from '../middleware/authMiddleware';

const router = Router();
const config = new ConfigService();
const logger = new LoggerService();
const redis = new RedisService();

// Rate limiting for data ingestion (higher limits)
const ingestRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many ingestion requests, please slow down'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by market ID if available, otherwise by IP
    const marketId = (req as AuthRequest).user?.marketId || req.ip;
    return `ingest:${marketId}`;
  }
});

// Validation schemas
const invoiceItemSchema = z.object({
  numeroItem: z.number().int().positive(),
  codigoEAN: z.string().min(1),
  codigoInterno: z.string().min(1),
  descricao: z.string().min(1),
  ncm: z.string().min(8).max(8),
  cfop: z.string().min(4).max(4),
  unidadeComercial: z.string().min(1),
  quantidade: z.number().positive(),
  valorUnitario: z.number().positive(),
  valorTotal: z.number().positive(),
  tributos: z.object({
    icms: z.object({
      situacaoTributaria: z.string(),
      baseCalculo: z.number().optional(),
      aliquota: z.number().optional(),
      valor: z.number().optional()
    }).optional(),
    pis: z.object({
      situacaoTributaria: z.string(),
      baseCalculo: z.number().optional(),
      aliquota: z.number().optional(),
      valor: z.number().optional()
    }).optional(),
    cofins: z.object({
      situacaoTributaria: z.string(),
      baseCalculo: z.number().optional(),
      aliquota: z.number().optional(),
      valor: z.number().optional()
    }).optional(),
    ipi: z.object({
      situacaoTributaria: z.string(),
      baseCalculo: z.number().optional(),
      aliquota: z.number().optional(),
      valor: z.number().optional()
    }).optional()
  }).optional(),
  categoria: z.string().optional(),
  marca: z.string().optional(),
  origem: z.string().optional()
});

const invoiceDataSchema = z.object({
  chaveNFe: z.string().length(44, 'Chave NFe must be 44 characters'),
  serie: z.string().min(1),
  numero: z.string().min(1),
  dataEmissao: z.string().datetime(),
  documentType: z.enum(['NFE', 'NFCE']),
  xmlVersion: z.enum(['VERSION_310', 'VERSION_400', 'UNKNOWN']),
  cnpjEmitente: z.string().min(14).max(14),
  nomeEmitente: z.string().min(1),
  cpfCnpjDestinatario: z.string().optional(),
  nomeDestinatario: z.string().optional(),
  valorTotal: z.number().positive(),
  valorTotalItens: z.number().positive(),
  valorTotalTributos: z.number().optional(),
  itens: z.array(invoiceItemSchema).min(1),
  observacoes: z.string().optional(),
  informacoesAdicionais: z.string().optional()
});

const ingestionRequestSchema = z.object({
  chaveNFe: z.string().length(44),
  marketId: z.string().uuid(),
  pdvId: z.string().uuid().optional(),
  agentVersion: z.string().min(1),
  rawXmlHash: z.string().min(1),
  invoice: invoiceDataSchema
});

const batchIngestionSchema = z.object({
  invoices: z.array(ingestionRequestSchema).min(1).max(100),
  processOptions: z.object({
    skipDuplicates: z.boolean().default(true),
    validateSchema: z.boolean().default(true),
    updateIfExists: z.boolean().default(false)
  }).optional()
});

// Helper functions
async function validateInvoice(invoice: any): Promise<InvoiceValidationResult> {
  const errors: any[] = [];
  const warnings: any[] = [];

  // Validate chave NFe format
  if (!/^\d{44}$/.test(invoice.chaveNFe)) {
    errors.push({
      field: 'chaveNFe',
      code: 'INVALID_FORMAT',
      message: 'Chave NFe must contain exactly 44 digits'
    });
  }

  // Validate CNPJ format
  if (!/^\d{14}$/.test(invoice.cnpjEmitente)) {
    errors.push({
      field: 'cnpjEmitente',
      code: 'INVALID_FORMAT',
      message: 'CNPJ must contain exactly 14 digits'
    });
  }

  // Validate date
  const emissionDate = new Date(invoice.dataEmissao);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  if (emissionDate > now) {
    warnings.push({
      field: 'dataEmissao',
      code: 'FUTURE_DATE',
      message: 'Emission date is in the future',
      suggestion: 'Verify the emission date'
    });
  }

  if (emissionDate < oneYearAgo) {
    warnings.push({
      field: 'dataEmissao',
      code: 'OLD_DATE',
      message: 'Emission date is more than 1 year old',
      suggestion: 'Verify if this is the correct date'
    });
  }

  // Validate items total
  const calculatedTotal = invoice.itens.reduce((sum: number, item: any) => sum + item.valorTotal, 0);
  const tolerance = 0.02; // 2 cents tolerance

  if (Math.abs(calculatedTotal - invoice.valorTotalItens) > tolerance) {
    warnings.push({
      field: 'valorTotalItens',
      code: 'TOTAL_MISMATCH',
      message: 'Items total does not match calculated sum',
      suggestion: 'Verify item values'
    });
  }

  // Validate NCM codes
  invoice.itens.forEach((item: any, index: number) => {
    if (!/^\d{8}$/.test(item.ncm)) {
      errors.push({
        field: `itens[${index}].ncm`,
        code: 'INVALID_FORMAT',
        message: 'NCM must contain exactly 8 digits',
        value: item.ncm
      });
    }
  });

  // Validate CFOP codes
  invoice.itens.forEach((item: any, index: number) => {
    if (!/^\d{4}$/.test(item.cfop)) {
      errors.push({
        field: `itens[${index}].cfop`,
        code: 'INVALID_FORMAT',
        message: 'CFOP must contain exactly 4 digits',
        value: item.cfop
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

async function findOrCreateProduct(item: any): Promise<string> {
  // Use upsert for atomic find-or-create operation (prevents race conditions)
  const product = await prisma.product.upsert({
    where: { ean: item.codigoEAN },
    update: {
      // Update name if changed (products can have description updates)
      name: item.descricao,
      // Update category if it was "Não categorizado" before
      category: item.categoria || 'Não categorizado',
      // Update brand if it was null before
      brand: item.marca || undefined,
    },
    create: {
      ean: item.codigoEAN,
      name: item.descricao,
      category: item.categoria || 'Não categorizado',
      brand: item.marca || null,
      unit: item.unidadeComercial
    }
  });

  // Log only if it was newly created (check if createdAt is recent)
  const isNewlyCreated = new Date().getTime() - product.createdAt.getTime() < 1000;
  if (isNewlyCreated) {
    logger.business('New product created from invoice', {
      productId: product.id,
      ean: product.ean,
      name: product.name
    });
  }

  return product.id;
}

async function processInvoice(request: InvoiceIngestionRequest, userId: string): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const { chaveNFe, marketId, pdvId, rawXmlHash, invoice } = request;

    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { chaveNFe }
    });

    if (existingInvoice) {
      logger.warn('Duplicate invoice ingestion attempt', {
        chaveNFe,
        marketId,
        existingInvoiceId: existingInvoice.id
      });

      return {
        success: false,
        error: 'Invoice already exists'
      };
    }

    // Validate market access
    const market = await prisma.market.findUnique({
      where: { id: marketId }
    });

    if (!market) {
      return {
        success: false,
        error: 'Market not found'
      };
    }

    // Validate PDV if provided
    if (pdvId) {
      const pdv = await prisma.pDV.findFirst({
        where: { id: pdvId, marketId }
      });
      if (!pdv) {
        return {
          success: false,
          error: 'PDV not found for this market'
        };
      }
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create invoice
      const createdInvoice = await tx.invoice.create({
        data: {
          chaveNFe,
          marketId,
          pdvId: pdvId || null,
          serie: invoice.serie,
          numero: invoice.numero,
          dataEmissao: new Date(invoice.dataEmissao),
          cnpjEmitente: invoice.cnpjEmitente,
          cpfCnpjDestinatario: invoice.cpfCnpjDestinatario || null,
          valorTotal: invoice.valorTotal,
          rawXmlHash,
          documentType: invoice.documentType,
          xmlVersion: invoice.xmlVersion,
          processedAt: new Date()
        }
      });

      // Process items
      for (const item of invoice.itens) {
        // Find or create product
        const productId = await findOrCreateProduct(item);

        // Create invoice item
        await tx.invoiceItem.create({
          data: {
            invoiceId: createdInvoice.id,
            productId,
            codigoEAN: item.codigoEAN,
            codigoInterno: item.codigoInterno,
            descricao: item.descricao,
            ncm: item.ncm,
            cfop: item.cfop,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            icms: item.tributos?.icms?.valor || null,
            pis: item.tributos?.pis?.valor || null,
            cofins: item.tributos?.cofins?.valor || null
          }
        });
      }

      return createdInvoice;
    });

    // Log successful ingestion
    logger.events.invoiceProcessed(result.id, marketId, chaveNFe);

    // Cache invoice for quick lookup
    await redis.set(`invoice:${chaveNFe}`, result.id, 3600); // 1 hour

    return {
      success: true,
      invoiceId: result.id
    };

  } catch (error) {
    logger.error('Invoice processing error', {
      chaveNFe: request.chaveNFe,
      marketId: request.marketId,
      error: error instanceof Error ? error.message : error
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  }
}

// Routes

/**
 * POST /api/v1/ingest/invoice
 * Single invoice ingestion
 */
router.post('/invoice', ingestRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = ingestionRequestSchema.parse(req.body);

    // Validate that user can access this market
    if (user.role !== 'ADMIN' && user.marketId !== validatedData.marketId) {
      logger.security('Unauthorized market access attempt', {
        userId: user.id,
        userMarketId: user.marketId,
        requestedMarketId: validatedData.marketId,
        chaveNFe: validatedData.chaveNFe
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this market'
        }
      });
    }

    // Validate invoice data
    const validation = await validateInvoice(validatedData.invoice);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invoice validation failed',
          details: {
            errors: validation.errors,
            warnings: validation.warnings
          }
        }
      });
    }

    // Process invoice - ensure type compatibility
    const invoiceRequest: InvoiceIngestionRequest = {
      chaveNFe: validatedData.chaveNFe,
      marketId: validatedData.marketId,
      ...(validatedData.pdvId && { pdvId: validatedData.pdvId }),
      agentVersion: validatedData.agentVersion,
      rawXmlHash: validatedData.rawXmlHash,
      invoice: {
        ...validatedData.invoice,
        ...(validatedData.invoice.cpfCnpjDestinatario !== undefined && {
          cpfCnpjDestinatario: validatedData.invoice.cpfCnpjDestinatario
        })
      } as InvoiceData
    };
    const result = await processInvoice(invoiceRequest, user.id);

    if (result.success) {
      const responseData: { invoiceId: string; warnings?: any[] } = {
        invoiceId: result.invoiceId!,
        ...(validation.warnings && validation.warnings.length > 0 && { warnings: validation.warnings })
      };

      const response: ApiResponse<typeof responseData> = {
        success: true,
        data: responseData,
        message: 'Invoice processed successfully'
      };

      return res.status(201).json(response);
    } else {
      if (result.error === 'Invoice already exists') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: result.error
          }
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: result.error || 'Failed to process invoice'
        }
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors
        }
      });
    }

    logger.error('Invoice ingestion error', {
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id,
      body: req.body
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process invoice'
      }
    });
  }
});

/**
 * POST /api/v1/ingest/batch
 * Batch invoice ingestion
 */
router.post('/batch', ingestRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = batchIngestionSchema.parse(req.body);
    const { invoices, processOptions = {} } = validatedData;

    // Validate market access for all invoices
    for (const invoice of invoices) {
      if (user.role !== 'ADMIN' && user.marketId !== invoice.marketId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to one or more markets'
          }
        });
      }
    }

    const results: BatchInvoiceResponse = {
      processed: 0,
      skipped: 0,
      errors: 0,
      results: []
    };

    // Process each invoice
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];

      if (!invoice) continue;

      try {
        // Validate invoice if requested
        const validateSchema = (processOptions as any)?.validateSchema ?? true;
        if (validateSchema !== false) {
          const validation = await validateInvoice(invoice.invoice);
          if (!validation.isValid) {
            results.errors++;
            results.results.push({
              chaveNFe: invoice.chaveNFe,
              status: 'error' as const,
              message: 'Validation failed: ' + validation.errors.map(e => e.message).join(', ')
            });
            continue;
          }
        }

        // Check for duplicates if requested
        const skipDuplicates = (processOptions as any)?.skipDuplicates ?? true;
        if (skipDuplicates !== false) {
          const existing = await prisma.invoice.findUnique({
            where: { chaveNFe: invoice.chaveNFe }
          });

          if (existing) {
            results.skipped++;
            results.results.push({
              chaveNFe: invoice.chaveNFe,
              status: 'skipped' as const,
              message: 'Invoice already exists'
            });
            continue;
          }
        }

        // Process invoice - ensure type compatibility
        const invoiceRequest: InvoiceIngestionRequest = {
          chaveNFe: invoice.chaveNFe,
          marketId: invoice.marketId,
          ...(invoice.pdvId && { pdvId: invoice.pdvId }),
          agentVersion: invoice.agentVersion,
          rawXmlHash: invoice.rawXmlHash,
          invoice: {
            ...invoice.invoice,
            ...(invoice.invoice.cpfCnpjDestinatario !== undefined && {
              cpfCnpjDestinatario: invoice.invoice.cpfCnpjDestinatario
            })
          } as InvoiceData
        };
        const result = await processInvoice(invoiceRequest, user.id);

        if (result.success) {
          results.processed++;
          const resultItem: { chaveNFe: string; status: 'success'; invoiceId?: string } = {
            chaveNFe: invoice.chaveNFe,
            status: 'success' as const,
            ...(result.invoiceId && { invoiceId: result.invoiceId })
          };
          results.results.push(resultItem);
        } else {
          results.errors++;
          results.results.push({
            chaveNFe: invoice.chaveNFe,
            status: 'error' as const,
            message: result.error || 'Processing failed'
          });
        }

      } catch (error) {
        results.errors++;
        results.results.push({
          chaveNFe: invoice.chaveNFe,
          status: 'error' as const,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.business('Batch invoice processing completed', {
      userId: user.id,
      totalInvoices: invoices.length,
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors
    });

    const response: ApiResponse<BatchInvoiceResponse> = {
      success: true,
      data: results,
      message: `Batch processing completed: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors`
    };

    return res.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Batch request validation failed',
          details: error.errors
        }
      });
    }

    logger.error('Batch ingestion error', {
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process batch'
      }
    });
  }
});

/**
 * GET /api/v1/ingest/status/:chaveNFe
 * Check invoice processing status
 */
router.get('/status/:chaveNFe', async (req: AuthRequest, res: Response) => {
  try {
    const { chaveNFe } = req.params;
    const user = req.user!;

    // Validate chave NFe format
    if (!chaveNFe || !/^\d{44}$/.test(chaveNFe)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid chave NFe format'
        }
      });
    }

    // Check cache first
    const cachedInvoiceId = await redis.get(`invoice:${chaveNFe}`);
    if (cachedInvoiceId) {
      return res.json({
        success: true,
        data: {
          id: cachedInvoiceId as string,
          chaveNFe,
          status: 'processed',
          invoiceId: cachedInvoiceId,
          processedAt: new Date().toISOString() // Approximate
        }
      });
    }

    // Query database
    const invoice = await prisma.invoice.findUnique({
      where: { chaveNFe: chaveNFe! },
      select: {
        id: true,
        marketId: true,
        processedAt: true,
        market: {
          select: {
            name: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invoice not found'
        }
      });
    }

    // Check access
    if (user.role !== 'ADMIN' && user.marketId !== invoice.marketId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: invoice.id,
        chaveNFe,
        status: 'processed',
        invoiceId: invoice.id,
        processedAt: invoice.processedAt,
        market: invoice.market || null
      }
    });

  } catch (error) {
    logger.error('Status check error', {
      error: error instanceof Error ? error.message : error,
      chaveNFe: req.params.chaveNFe,
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check status'
      }
    });
  }
});

export default router;
