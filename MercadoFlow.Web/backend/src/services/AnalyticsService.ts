import { prisma } from '@/lib/prisma';
import { LoggerService } from './LoggerService';

const logger = new LoggerService();

export interface DashboardSummary {
  totalSales: number;
  totalTransactions: number;
  avgTicket: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface ProductMetrics {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  transactionCount: number;
  avgPrice: number;
  growthRate?: number;
}

export interface SalesТrend {
  date: Date;
  revenue: number;
  transactions: number;
  avgTicket: number;
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  quantitySold: number;
  productCount: number;
  shareOfTotal: number;
}

export class AnalyticsService {
  /**
   * Get dashboard summary for a market
   */
  async getDashboardSummary(marketId: string, startDate: Date, endDate: Date): Promise<DashboardSummary> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          marketId,
          dataEmissao: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          valorTotal: true,
        },
      });

      const totalSales = invoices.reduce((sum, inv) => sum + inv.valorTotal, 0);
      const totalTransactions = invoices.length;
      const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      return {
        totalSales,
        totalTransactions,
        avgTicket,
        period: { start: startDate, end: endDate },
      };
    } catch (error) {
      logger.error('Error calculating dashboard summary', { error, marketId });
      throw error;
    }
  }

  /**
   * Get top selling products for a market
   */
  async getTopSellingProducts(marketId: string, startDate: Date, endDate: Date, limit: number = 10): Promise<ProductMetrics[]> {
    try {
      const analytics = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          product: true,
        },
      });

      // Aggregate by product
      const productMap = new Map<string, ProductMetrics>();

      for (const record of analytics) {
        const existing = productMap.get(record.productId) || {
          productId: record.productId,
          productName: record.product.name,
          quantitySold: 0,
          revenue: 0,
          transactionCount: 0,
          avgPrice: 0,
        };

        existing.quantitySold += record.quantitySold;
        existing.revenue += record.revenue;
        existing.transactionCount += record.transactionCount;

        productMap.set(record.productId, existing);
      }

      // Calculate averages and sort
      const products = Array.from(productMap.values())
        .map((p) => ({
          ...p,
          avgPrice: p.quantitySold > 0 ? p.revenue / p.quantitySold : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

      return products;
    } catch (error) {
      logger.error('Error getting top selling products', { error, marketId });
      throw error;
    }
  }

  /**
   * Get sales trend over time
   */
  async getSalesTrend(marketId: string, startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<SalesТrend[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          marketId,
          dataEmissao: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          dataEmissao: true,
          valorTotal: true,
        },
        orderBy: {
          dataEmissao: 'asc',
        },
      });

      // Group by date
      const trendMap = new Map<string, { revenue: number; count: number }>();

      for (const invoice of invoices) {
        const dateKey = this.getDateKey(invoice.dataEmissao, groupBy);
        const existing = trendMap.get(dateKey) || { revenue: 0, count: 0 };
        existing.revenue += invoice.valorTotal;
        existing.count += 1;
        trendMap.set(dateKey, existing);
      }

      // Convert to array and sort
      const trend = Array.from(trendMap.entries())
        .map(([dateStr, data]) => ({
          date: new Date(dateStr),
          revenue: data.revenue,
          transactions: data.count,
          avgTicket: data.count > 0 ? data.revenue / data.count : 0,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      return trend;
    } catch (error) {
      logger.error('Error getting sales trend', { error, marketId });
      throw error;
    }
  }

  /**
   * Get category performance
   */
  async getCategoryPerformance(marketId: string, startDate: Date, endDate: Date): Promise<CategoryPerformance[]> {
    try {
      const analytics = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          product: true,
        },
      });

      // Aggregate by category
      const categoryMap = new Map<string, { revenue: number; quantity: number; products: Set<string> }>();

      for (const record of analytics) {
        const category = record.product.category;
        const existing = categoryMap.get(category) || { revenue: 0, quantity: 0, products: new Set() };
        existing.revenue += record.revenue;
        existing.quantity += record.quantitySold;
        existing.products.add(record.productId);
        categoryMap.set(category, existing);
      }

      // Calculate totals
      const totalRevenue = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.revenue, 0);

      // Convert to array
      const categories = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          revenue: data.revenue,
          quantitySold: data.quantity,
          productCount: data.products.size,
          shareOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return categories;
    } catch (error) {
      logger.error('Error getting category performance', { error, marketId });
      throw error;
    }
  }

  /**
   * Calculate product at risk (low stock or slow moving)
   */
  async getProductsAtRisk(marketId: string): Promise<ProductMetrics[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get products with low recent sales
      const recentAnalytics = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: sevenDaysAgo,
          },
        },
        include: {
          product: true,
        },
      });

      // Get all products sold in last 30 days
      const allProductIds = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          productId: true,
        },
        distinct: ['productId'],
      });

      // Find products with no recent sales
      const recentProductIds = new Set(recentAnalytics.map((a) => a.productId));
      const atRiskIds = allProductIds.filter((p) => !recentProductIds.has(p.productId)).map((p) => p.productId);

      // Get product details
      const atRiskProducts = await prisma.product.findMany({
        where: {
          id: {
            in: atRiskIds,
          },
        },
        include: {
          salesAnalytics: {
            where: {
              marketId,
              date: {
                gte: thirtyDaysAgo,
              },
            },
          },
        },
      });

      return atRiskProducts.map((product) => {
        const totalRevenue = product.salesAnalytics.reduce((sum, a) => sum + a.revenue, 0);
        const totalQuantity = product.salesAnalytics.reduce((sum, a) => sum + a.quantitySold, 0);

        return {
          productId: product.id,
          productName: product.name,
          quantitySold: totalQuantity,
          revenue: totalRevenue,
          transactionCount: product.salesAnalytics.length,
          avgPrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
        };
      });
    } catch (error) {
      logger.error('Error getting products at risk', { error, marketId });
      throw error;
    }
  }

  /**
   * Helper to group dates by period
   */
  private getDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    switch (groupBy) {
      case 'day':
        return d.toISOString().split('T')[0] ?? d.toISOString();
      case 'week':
        // Get Monday of the week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().split('T')[0] ?? d.toISOString();
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      default:
        return d.toISOString().split('T')[0] ?? d.toISOString();
    }
  }
}

export const analyticsService = new AnalyticsService();
