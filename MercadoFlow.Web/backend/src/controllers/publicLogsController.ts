import { Router, Request, Response } from 'express';
import { config, logger, redis } from '@/lib/services';
import { prisma } from '@/lib/prisma';

const router = Router();

router.get('/logs', (req: Request, res: Response) => {
  const enabled = config.get('PUBLIC_LOGS_ENABLED', true);
  if (!enabled) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }

  const token = config.get('PUBLIC_LOGS_TOKEN', '');
  if (token && req.query.token !== token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid token'
      }
    });
  }

  const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 1000);
  const level = req.query.level ? String(req.query.level) : undefined;
  const contains = req.query.contains ? String(req.query.contains) : undefined;
  const since = req.query.since ? String(req.query.since) : undefined;

  const queryOptions: { limit: number; level?: string; contains?: string; since?: string } = { limit };
  if (level) queryOptions.level = level;
  if (contains) queryOptions.contains = contains;
  if (since) queryOptions.since = since;

  const logs = logger.getRecentLogs(queryOptions);

  return res.json({
    success: true,
    data: {
      count: logs.length,
      logs
    }
  });
});

router.delete('/logs', (req: Request, res: Response) => {
  const enabled = config.get('PUBLIC_LOGS_ENABLED', true);
  if (!enabled) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }

  const token = config.get('PUBLIC_LOGS_TOKEN', '');
  if (token && req.query.token !== token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid token'
      }
    });
  }

  logger.clearRecentLogs();

  return res.json({
    success: true,
    data: {
      message: 'Logs cleared'
    }
  });
});

router.get('/ingest-status', async (req: Request, res: Response) => {
  const enabled = config.get('PUBLIC_LOGS_ENABLED', true);
  if (!enabled) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }

  const token = config.get('PUBLIC_LOGS_TOKEN', '');
  if (token && req.query.token !== token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid token'
      }
    });
  }

  const marketId = String(req.query.marketId || '').trim();
  if (!marketId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'marketId is required'
      }
    });
  }

  const [lastBatch, totalInvoices, lastInvoice] = await Promise.all([
    redis.get(`ingest:last:${marketId}`),
    prisma.invoice.count({ where: { marketId } }),
    prisma.invoice.findFirst({
      where: { marketId },
      select: { chaveNFe: true, dataEmissao: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return res.json({
    success: true,
    data: {
      marketId,
      totalInvoices,
      lastInvoice,
      lastBatch
    }
  });
});

export default router;
