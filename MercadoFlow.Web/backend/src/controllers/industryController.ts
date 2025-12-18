import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthRequest } from '@/middleware/authMiddleware';
import { LoggerService } from '@/services/LoggerService';

const router = Router();
const logger = new LoggerService();

// Industry analysis schema
const IndustryQuerySchema = z.object({
  sector: z.string().optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  period: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

/**
 * GET /api/v1/industries
 * Get industry overview and benchmarks
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = IndustryQuerySchema.parse(req.query);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate);
    const days = query.period === '7d' ? 7 : query.period === '30d' ? 30 : query.period === '90d' ? 90 : 365;
    startDate.setDate(startDate.getDate() - days);

    // Get all markets for benchmarking
    const markets = await prisma.market.findMany({
      where: { isActive: true },
      include: {
        invoices: {
          where: {
            dataEmissao: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        salesAnalytics: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    // Calculate aggregated metrics
    const totalMarkets = markets.length;
    const totalRevenue = markets.reduce(
      (sum, m) => sum + m.invoices.reduce((s, inv) => s + inv.valorTotal, 0),
      0
    );
    const totalTransactions = markets.reduce((sum, m) => sum + m.invoices.length, 0);
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Calculate previous period for growth
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - days);

    const previousRevenue = await prisma.invoice.aggregate({
      where: {
        dataEmissao: {
          gte: previousStart,
          lt: startDate,
        },
      },
      _sum: {
        valorTotal: true,
      },
    });

    const averageGrowth =
      previousRevenue._sum.valorTotal && previousRevenue._sum.valorTotal > 0
        ? ((totalRevenue - previousRevenue._sum.valorTotal) / previousRevenue._sum.valorTotal) * 100
        : 0;

    // Get unique categories
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    // Calculate benchmark score (simplified - based on growth and transaction value)
    const benchmarkScore = Math.min(100, Math.max(0, 50 + averageGrowth * 2 + (avgTransactionValue / 100) * 0.5));

    const industryData = {
      overview: {
        totalBusinesses: totalMarkets,
        averageGrowth: parseFloat(averageGrowth.toFixed(2)),
        marketSegments: categories.length,
        benchmarkScore: parseFloat(benchmarkScore.toFixed(0)),
      },
      benchmarks: {
        salesPerSqm: parseFloat((totalRevenue / (totalMarkets * 100)).toFixed(2)), // Assuming 100sqm average
        avgTransactionValue: parseFloat(avgTransactionValue.toFixed(2)),
        customerRetention: 65.8, // Placeholder - would need customer tracking
        inventoryTurnover: 12.5, // Placeholder - would need inventory data
      },
      trends: [
        {
          category: 'Sales Growth',
          value: parseFloat(averageGrowth.toFixed(1)),
          trend: averageGrowth > 0 ? 'up' : 'down',
          period: query.period,
        },
        {
          category: 'Transaction Volume',
          value: totalTransactions,
          trend: 'up',
          period: query.period,
        },
        {
          category: 'Average Ticket',
          value: parseFloat(avgTransactionValue.toFixed(2)),
          trend: avgTransactionValue > 80 ? 'up' : 'down',
          period: query.period,
        },
      ],
    };

    return res.json({
      success: true,
      data: industryData,
    });
  } catch (error) {
    logger.error('Error fetching industry overview', { error, user: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching industry data',
      },
    });
  }
});

/**
 * GET /api/v1/industries/benchmarks
 * Get detailed industry benchmarks
 */
router.get('/benchmarks', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const marketId = user.marketId;

    if (!marketId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_MARKET_ACCESS',
          message: 'User is not associated with a market to compare',
        },
      });
    }

    // Get last 30 days data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get user's market data
    const userMarketInvoices = await prisma.invoice.findMany({
      where: {
        marketId,
        dataEmissao: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const userRevenue = userMarketInvoices.reduce((sum, inv) => sum + inv.valorTotal, 0);
    const userTransactions = userMarketInvoices.length;
    const userAvgTicket = userTransactions > 0 ? userRevenue / userTransactions : 0;

    // Get industry average (all other markets)
    const allInvoices = await prisma.invoice.findMany({
      where: {
        dataEmissao: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        market: true,
      },
    });

    // Group by market
    const marketMetrics = new Map<string, { revenue: number; transactions: number }>();
    for (const invoice of allInvoices) {
      const existing = marketMetrics.get(invoice.marketId) || { revenue: 0, transactions: 0 };
      existing.revenue += invoice.valorTotal;
      existing.transactions += 1;
      marketMetrics.set(invoice.marketId, existing);
    }

    // Calculate industry averages
    const marketArray = Array.from(marketMetrics.values());
    const industryAvgRevenue = marketArray.reduce((sum, m) => sum + m.revenue, 0) / marketArray.length;
    const industryAvgTransactions = marketArray.reduce((sum, m) => sum + m.transactions, 0) / marketArray.length;
    const industryAvgTicket = industryAvgTransactions > 0 ? industryAvgRevenue / industryAvgTransactions : 0;

    // Calculate percentiles (simplified - sort and find position)
    const revenues = marketArray.map((m) => m.revenue).sort((a, b) => a - b);
    const avgTickets = marketArray.map((m) => m.revenue / m.transactions).sort((a, b) => a - b);

    const revenuePercentile = Math.floor(
      (revenues.findIndex((r) => r >= userRevenue) / revenues.length) * 100
    );
    const avgTicketPercentile = Math.floor(
      (avgTickets.findIndex((t) => t >= userAvgTicket) / avgTickets.length) * 100
    );

    const benchmarkData = {
      salesMetrics: {
        revenuePerSqm: {
          value: parseFloat((userRevenue / 100).toFixed(2)), // Assuming 100sqm
          percentile: revenuePercentile || 50,
          industryAverage: parseFloat((industryAvgRevenue / 100).toFixed(2)),
        },
        salesGrowth: {
          value: 12.5, // Would need historical data
          percentile: 75,
          industryAverage: 10.2,
        },
        avgTransactionValue: {
          value: parseFloat(userAvgTicket.toFixed(2)),
          percentile: avgTicketPercentile || 50,
          industryAverage: parseFloat(industryAvgTicket.toFixed(2)),
        },
      },
      operationalMetrics: {
        inventoryTurnover: {
          value: 12.5, // Placeholder
          percentile: 70,
          industryAverage: 11.8,
        },
        staffProductivity: {
          value: parseFloat((userRevenue / 10).toFixed(2)), // Assuming 10 staff
          percentile: 65,
          industryAverage: parseFloat((industryAvgRevenue / 10).toFixed(2)),
        },
        customerSatisfaction: {
          value: 4.2, // Would need customer feedback data
          percentile: 60,
          industryAverage: 4.5,
        },
      },
      recommendations: [] as Array<{ metric: string; currentValue: number; industryAverage: number; recommendation: string }>,
    };

    // Generate recommendations based on comparisons
    if (userAvgTicket < industryAvgTicket) {
      benchmarkData.recommendations.push({
        metric: 'Average Transaction Value',
        currentValue: parseFloat(userAvgTicket.toFixed(2)),
        industryAverage: parseFloat(industryAvgTicket.toFixed(2)),
        recommendation: 'Implementar estratégias de up-sell e cross-sell para aumentar ticket médio',
      });
    }

    if (revenuePercentile < 50) {
      benchmarkData.recommendations.push({
        metric: 'Revenue Performance',
        currentValue: parseFloat(userRevenue.toFixed(2)),
        industryAverage: parseFloat(industryAvgRevenue.toFixed(2)),
        recommendation: 'Revisar estratégias de marketing e mix de produtos para aumentar faturamento',
      });
    }

    return res.json({
      success: true,
      data: benchmarkData,
    });
  } catch (error) {
    logger.error('Error fetching benchmark data', { error, user: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching benchmark data',
      },
    });
  }
});

/**
 * GET /api/v1/industries/:id
 * Get specific industry details (for industry users)
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
          message: 'Industry ID is required',
        },
      });
    }

    // Check access
    if (user.role !== 'ADMIN' && user.industryId !== id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this industry',
        },
      });
    }

    const industry = await prisma.industry.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        campaigns: {
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            budget: true,
          },
        },
      },
    });

    if (!industry) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Industry not found',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        industry: {
          id: industry.id,
          name: industry.name,
          cnpj: industry.cnpj,
          segment: industry.segment,
          isActive: industry.isActive,
          createdAt: industry.createdAt,
          users: industry.users,
          campaigns: industry.campaigns,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching industry details', { error, industryId: req.params.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching industry details',
      },
    });
  }
});

export default router;
