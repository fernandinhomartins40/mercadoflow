import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { analyticsService } from '@/services/AnalyticsService';
import { AuthRequest } from '@/middleware/authMiddleware';
import { LoggerService } from '@/services/LoggerService';

const router = Router();
const logger = new LoggerService();

// Market analysis schema
const MarketQuerySchema = z.object({
  region: z.string().optional(),
  category: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

/**
 * GET /api/v1/markets
 * Get market overview and statistics
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = MarketQuerySchema.parse(req.query);

    // Check if user has market access
    if (user.role === 'INDUSTRY_USER' && !user.industryId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_INDUSTRY_ACCESS',
          message: 'User is not associated with an industry',
        },
      });
    }

    // Get all markets (for admins) or specific market (for market users)
    const marketsQuery = {
      where: {} as any,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        pdvs: {
          where: { isActive: true },
        },
        _count: {
          select: {
            invoices: true,
            salesAnalytics: true,
            alerts: true,
          },
        },
      },
    };

    // Filter by user role
    if (user.role === 'MARKET_OWNER' || user.role === 'MARKET_MANAGER') {
      if (!user.marketId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'NO_MARKET_ACCESS',
            message: 'User is not associated with a market',
          },
        });
      }
      marketsQuery.where.id = user.marketId;
    }

    // Filter by region if specified
    if (query.region) {
      marketsQuery.where.region = query.region;
    }

    const markets = await prisma.market.findMany(marketsQuery);

    // Calculate overview metrics
    const totalMarkets = markets.length;
    const activeMarkets = markets.filter((m) => m.isActive).length;

    // Get total invoices and revenue for all markets
    const totalInvoices = markets.reduce((sum, m) => sum + m._count.invoices, 0);
    const totalAlerts = markets.reduce((sum, m) => sum + m._count.alerts, 0);

    // Calculate market share (simplified - assuming total is 100 markets in the region)
    const marketShare = (totalMarkets / 100) * 100;

    const marketData = {
      overview: {
        totalMarkets,
        activeMarkets,
        marketShare: parseFloat(marketShare.toFixed(2)),
        totalInvoicesProcessed: totalInvoices,
        activeAlerts: totalAlerts,
      },
      markets: markets.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        state: m.state,
        region: m.region,
        planType: m.planType,
        isActive: m.isActive,
        pdvCount: m.pdvs.length,
        invoiceCount: m._count.invoices,
        alertCount: m._count.alerts,
        userCount: m.users.length,
      })),
    };

    return res.json({
      success: true,
      data: marketData,
    });
  } catch (error) {
    logger.error('Error fetching market overview', { error, user: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching market data',
      },
    });
  }
});

/**
 * GET /api/v1/markets/analysis
 * Get detailed market basket analysis
 */
router.get('/analysis', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const marketId = user.marketId;

    if (!marketId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_MARKET_ACCESS',
          message: 'User is not associated with a market',
        },
      });
    }

    // Get market basket analysis (product associations)
    const marketBaskets = await prisma.marketBasket.findMany({
      where: { marketId },
      include: {
        product1: {
          select: {
            id: true,
            name: true,
            category: true,
            ean: true,
          },
        },
        product2: {
          select: {
            id: true,
            name: true,
            category: true,
            ean: true,
          },
        },
      },
      orderBy: {
        lift: 'desc',
      },
      take: 20,
    });

    // Get category performance for price comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const categories = await analyticsService.getCategoryPerformance(marketId, thirtyDaysAgo, new Date());

    const analysisData = {
      marketBasketAnalysis: {
        frequentItemsets: marketBaskets.slice(0, 10).map((mb) => ({
          product1: mb.product1.name,
          product2: mb.product2.name,
          support: mb.support,
          confidence: mb.confidence,
          lift: mb.lift,
          category1: mb.product1.category,
          category2: mb.product2.category,
        })),
        associationRules: marketBaskets.map((mb) => ({
          if: mb.product1.name,
          then: mb.product2.name,
          confidence: mb.confidence,
          lift: mb.lift,
          recommendation: mb.lift > 1 ? `Clientes que compram ${mb.product1.name} tendem a comprar ${mb.product2.name}` : null,
        })),
        recommendations: marketBaskets
          .filter((mb) => mb.lift > 1.5)
          .slice(0, 5)
          .map((mb) => ({
            type: 'cross-sell',
            priority: mb.lift > 2 ? 'high' : 'medium',
            title: `Oportunidade de venda cruzada`,
            description: `Posicione ${mb.product2.name} próximo a ${mb.product1.name} (lift: ${mb.lift.toFixed(2)})`,
          })),
      },
      categoryPerformance: {
        topCategories: categories.slice(0, 5).map((c) => ({
          category: c.category,
          revenue: c.revenue,
          shareOfTotal: c.shareOfTotal,
          productCount: c.productCount,
        })),
        recommendations: categories
          .filter((c) => c.shareOfTotal < 5)
          .slice(0, 3)
          .map((c) => ({
            category: c.category,
            currentShare: c.shareOfTotal,
            recommendation: `Categoria com baixa participação (${c.shareOfTotal.toFixed(1)}%). Considere expandir sortimento.`,
          })),
      },
    };

    return res.json({
      success: true,
      data: analysisData,
    });
  } catch (error) {
    logger.error('Error performing market analysis', { error, user: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error performing market analysis',
      },
    });
  }
});

/**
 * GET /api/v1/markets/:id
 * Get specific market details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Market ID is required',
        },
      });
    }

    // Check access
    if (user.role !== 'ADMIN' && user.marketId !== id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this market',
        },
      });
    }

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        pdvs: {
          select: {
            id: true,
            name: true,
            identifier: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            invoices: true,
            salesAnalytics: true,
            alerts: { where: { isRead: false } },
          },
        },
      },
    });

    if (!market) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Market not found',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        market: {
          id: market.id,
          name: market.name,
          cnpj: market.cnpj,
          address: market.address,
          city: market.city,
          state: market.state,
          region: market.region,
          planType: market.planType,
          isActive: market.isActive,
          createdAt: market.createdAt,
          owner: market.owner,
          users: market.users,
          pdvs: market.pdvs,
          stats: {
            totalInvoices: market._count.invoices,
            totalAnalytics: market._count.salesAnalytics,
            unreadAlerts: market._count.alerts,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching market details', { error, marketId: req.params.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching market details',
      },
    });
  }
});

export default router;
