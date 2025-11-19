import { Router, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from '@/services/AnalyticsService';
import { alertService } from '@/services/AlertService';
import { AuthRequest } from '@/middleware/authMiddleware';
import { LoggerService } from '@/services/LoggerService';

const router = Router();
const logger = new LoggerService();

// Dashboard data schema
const DashboardQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

/**
 * Helper to calculate date range
 */
function getDateRange(period: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  let start: Date;

  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date(end);
    switch (period) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '365d':
        start.setDate(start.getDate() - 365);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
  }

  return { start, end };
}

/**
 * GET /api/v1/dashboard
 * Get dashboard overview with real data
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = DashboardQuerySchema.parse(req.query);

    // Get date range
    const { start, end } = getDateRange(query.period, query.startDate, query.endDate);

    // Get market ID from user
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

    // Fetch all data in parallel
    const [summary, topProducts, salesTrend, categories, alerts] = await Promise.all([
      analyticsService.getDashboardSummary(marketId, start, end),
      analyticsService.getTopSellingProducts(marketId, start, end, 5),
      analyticsService.getSalesTrend(marketId, start, end, 'day'),
      analyticsService.getCategoryPerformance(marketId, start, end),
      alertService.getUnreadAlerts(marketId, 5),
    ]);

    // Calculate growth (compare to previous period)
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);

    const previousSummary = await analyticsService.getDashboardSummary(marketId, previousStart, start);

    const salesGrowth =
      previousSummary.totalSales > 0 ? ((summary.totalSales - previousSummary.totalSales) / previousSummary.totalSales) * 100 : 0;

    const transactionsGrowth =
      previousSummary.totalTransactions > 0
        ? ((summary.totalTransactions - previousSummary.totalTransactions) / previousSummary.totalTransactions) * 100
        : 0;

    const ticketGrowth =
      previousSummary.avgTicket > 0 ? ((summary.avgTicket - previousSummary.avgTicket) / previousSummary.avgTicket) * 100 : 0;

    // Build dashboard response
    const dashboardData = {
      summary: {
        totalSales: summary.totalSales,
        totalTransactions: summary.totalTransactions,
        avgTicket: summary.avgTicket,
        topProducts: topProducts.length,
        growth: {
          sales: salesGrowth,
          transactions: transactionsGrowth,
          avgTicket: ticketGrowth,
        },
      },
      charts: {
        salesOverTime: salesTrend.map((t) => ({
          date: t.date.toISOString().split('T')[0],
          revenue: t.revenue,
          transactions: t.transactions,
          avgTicket: t.avgTicket,
        })),
        topCategories: categories.slice(0, 5).map((c) => ({
          category: c.category,
          revenue: c.revenue,
          share: c.shareOfTotal,
        })),
        topProducts: topProducts.map((p) => ({
          name: p.productName,
          revenue: p.revenue,
          quantity: p.quantitySold,
        })),
      },
      alerts: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        priority: a.priority,
        productName: a.product?.name,
        createdAt: a.createdAt,
      })),
      insights: [],
    };

    // Generate insights based on data
    if (salesGrowth > 10) {
      dashboardData.insights.push({
        type: 'positive',
        title: 'Crescimento nas vendas',
        description: `Vendas aumentaram ${salesGrowth.toFixed(1)}% em relação ao período anterior`,
      });
    } else if (salesGrowth < -10) {
      dashboardData.insights.push({
        type: 'negative',
        title: 'Queda nas vendas',
        description: `Vendas reduziram ${Math.abs(salesGrowth).toFixed(1)}% em relação ao período anterior`,
      });
    }

    if (alerts.length > 0) {
      const highPriorityAlerts = alerts.filter((a: any) => a.priority === 'HIGH' || a.priority === 'URGENT');
      if (highPriorityAlerts.length > 0) {
        dashboardData.insights.push({
          type: 'warning',
          title: `${highPriorityAlerts.length} alertas de alta prioridade`,
          description: 'Há alertas importantes que requerem sua atenção',
        });
      }
    }

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    logger.error('Error fetching dashboard data', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching dashboard data',
      },
    });
  }
});

/**
 * GET /api/v1/dashboard/sales
 * Get detailed sales data
 */
router.get('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = DashboardQuerySchema.parse(req.query);

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

    const { start, end } = getDateRange(query.period, query.startDate, query.endDate);

    const [summary, trend, categories, topProducts] = await Promise.all([
      analyticsService.getDashboardSummary(marketId, start, end),
      analyticsService.getSalesTrend(marketId, start, end, 'day'),
      analyticsService.getCategoryPerformance(marketId, start, end),
      analyticsService.getTopSellingProducts(marketId, start, end, 20),
    ]);

    const salesData = {
      totalSales: summary.totalSales,
      salesByPeriod: trend.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        revenue: t.revenue,
        transactions: t.transactions,
      })),
      salesByCategory: categories.map((c) => ({
        category: c.category,
        revenue: c.revenue,
        quantity: c.quantitySold,
        share: c.shareOfTotal,
      })),
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        revenue: p.revenue,
        quantity: p.quantitySold,
        avgPrice: p.avgPrice,
      })),
    };

    res.json({
      success: true,
      data: salesData,
    });
  } catch (error) {
    logger.error('Error fetching sales data', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching sales data',
      },
    });
  }
});

/**
 * GET /api/v1/dashboard/alerts
 * Get alerts for the market
 */
router.get('/alerts', async (req: AuthRequest, res: Response) => {
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

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const alerts = await alertService.getUnreadAlerts(marketId, limit);

    res.json({
      success: true,
      data: {
        alerts: alerts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          message: a.message,
          priority: a.priority,
          productId: a.productId,
          productName: a.product?.name,
          createdAt: a.createdAt,
        })),
        total: alerts.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching alerts', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching alerts',
      },
    });
  }
});

/**
 * POST /api/v1/dashboard/alerts/:id/read
 * Mark alert as read
 */
router.post('/alerts/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await alertService.markAsRead(id);

    res.json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    logger.error('Error marking alert as read', { error, alertId: req.params.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error marking alert as read',
      },
    });
  }
});

export default router;
