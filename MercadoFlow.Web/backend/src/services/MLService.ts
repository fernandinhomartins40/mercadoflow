import { prisma } from '@/lib/prisma';
import { LoggerService } from './LoggerService';

const logger = new LoggerService();

export interface ProductAssociation {
  product1Id: string;
  product2Id: string;
  support: number;
  confidence: number;
  lift: number;
}

export interface Transaction {
  id: string;
  items: string[]; // Product IDs
}

export class MLService {
  /**
   * Run Apriori algorithm to find frequent itemsets and association rules
   * Simplified implementation focused on product pairs
   */
  async runMarketBasketAnalysis(
    marketId: string,
    minSupport: number = 0.01,
    minConfidence: number = 0.1
  ): Promise<ProductAssociation[]> {
    try {
      logger.info('Starting market basket analysis', { marketId, minSupport, minConfidence });

      // Get recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const invoices = await prisma.invoice.findMany({
        where: {
          marketId,
          dataEmissao: {
            gte: thirtyDaysAgo,
          },
        },
        include: {
          items: {
            select: {
              productId: true,
            },
          },
        },
      });

      // Convert to transaction format
      const transactions: Transaction[] = invoices.map((inv) => ({
        id: inv.id,
        items: inv.items.map((item) => item.productId).filter((id): id is string => id !== null),
      }));

      const totalTransactions = transactions.length;

      if (totalTransactions === 0) {
        logger.warn('No transactions found for market basket analysis', { marketId });
        return [];
      }

      // Find product pairs (2-itemsets)
      const pairCounts = new Map<string, number>();
      const itemCounts = new Map<string, number>();

      // Count individual items and pairs
      for (const transaction of transactions) {
        const uniqueItems = Array.from(new Set(transaction.items));

        // Count individual items
        for (const item of uniqueItems) {
          itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
        }

        // Count pairs
        for (let i = 0; i < uniqueItems.length; i++) {
          for (let j = i + 1; j < uniqueItems.length; j++) {
            const item1 = uniqueItems[i];
            const item2 = uniqueItems[j];

            if (!item1 || !item2) continue;

            // Sort to ensure consistent pair key
            const pair = item1 < item2 ? `${item1}|${item2}` : `${item2}|${item1}`;
            pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
          }
        }
      }

      // Calculate association rules
      const associations: ProductAssociation[] = [];

      for (const [pairKey, pairCount] of pairCounts.entries()) {
        const [item1, item2] = pairKey.split('|');

        if (!item1 || !item2) continue;

        // Calculate support: P(A ∩ B)
        const support = pairCount / totalTransactions;

        // Only consider pairs above minimum support
        if (support < minSupport) {
          continue;
        }

        const item1Count = itemCounts.get(item1) || 0;
        const item2Count = itemCounts.get(item2) || 0;

        // Calculate confidence: P(B|A) = P(A ∩ B) / P(A)
        const confidenceAtoB = item1Count > 0 ? pairCount / item1Count : 0;
        const confidenceBtoA = item2Count > 0 ? pairCount / item2Count : 0;

        // Calculate lift: P(A ∩ B) / (P(A) * P(B))
        const expectedCount = (item1Count * item2Count) / totalTransactions;
        const lift = expectedCount > 0 ? pairCount / expectedCount : 0;

        // Create association for both directions
        if (confidenceAtoB >= minConfidence) {
          associations.push({
            product1Id: item1,
            product2Id: item2,
            support,
            confidence: confidenceAtoB,
            lift,
          });
        }

        if (confidenceBtoA >= minConfidence && item1 !== item2) {
          associations.push({
            product1Id: item2,
            product2Id: item1,
            support,
            confidence: confidenceBtoA,
            lift,
          });
        }
      }

      // Sort by lift (strongest associations first)
      associations.sort((a, b) => b.lift - a.lift);

      logger.business('Market basket analysis completed', {
        marketId,
        totalTransactions,
        associationsFound: associations.length,
      });

      return associations;
    } catch (error) {
      logger.error('Error running market basket analysis', { error, marketId });
      throw error;
    }
  }

  /**
   * Store market basket results in database
   */
  async storeMarketBasketResults(marketId: string, associations: ProductAssociation[]): Promise<number> {
    try {
      // Delete old results for this market
      await prisma.marketBasket.deleteMany({
        where: { marketId },
      });

      // Insert new results (limit to top 100)
      const topAssociations = associations.slice(0, 100);

      const data = topAssociations.map((assoc) => ({
        marketId,
        product1Id: assoc.product1Id,
        product2Id: assoc.product2Id,
        support: assoc.support,
        confidence: assoc.confidence,
        lift: assoc.lift,
        analyzedAt: new Date(),
      }));

      if (data.length === 0) {
        return 0;
      }

      const createOptions: any = {
        data,
        skipDuplicates: true,
      };
      const created = await prisma.marketBasket.createMany(createOptions);

      logger.business('Market basket results stored', {
        marketId,
        recordsCreated: created.count,
      });

      return created.count;
    } catch (error) {
      logger.error('Error storing market basket results', { error, marketId });
      throw error;
    }
  }

  /**
   * Run complete market basket analysis and store results
   */
  async analyzeAndStoreMarketBasket(marketId: string): Promise<{ associationsFound: number; stored: number }> {
    try {
      const associations = await this.runMarketBasketAnalysis(marketId, 0.01, 0.1);
      const stored = await this.storeMarketBasketResults(marketId, associations);

      return {
        associationsFound: associations.length,
        stored,
      };
    } catch (error) {
      logger.error('Error in complete market basket analysis', { error, marketId });
      throw error;
    }
  }

  /**
   * Generate product recommendations based on cart contents
   */
  async getProductRecommendations(marketId: string, productIds: string[], limit: number = 5): Promise<any[]> {
    try {
      if (productIds.length === 0) {
        return [];
      }

      // Find associations where any of the input products appear
      const associations = await prisma.marketBasket.findMany({
        where: {
          marketId,
          OR: productIds.map((id) => ({ product1Id: id })),
        },
        include: {
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
        take: limit * 2, // Get more to filter duplicates
      });

      // Remove products already in cart and duplicates
      const seen = new Set(productIds);
      const recommendations = [];

      for (const assoc of associations) {
        if (!seen.has(assoc.product2Id) && recommendations.length < limit) {
          seen.add(assoc.product2Id);
          recommendations.push({
            product: assoc.product2,
            confidence: assoc.confidence,
            lift: assoc.lift,
            reason: 'Frequentemente comprado junto',
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error getting product recommendations', { error, marketId });
      return [];
    }
  }

  /**
   * Simple demand forecasting based on historical sales
   * Uses moving average for prediction
   */
  async forecastDemand(marketId: string, productId: string, daysToForecast: number = 7): Promise<number[]> {
    try {
      // Get last 30 days of sales data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sales = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          productId,
          date: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: {
          date: 'asc',
        },
        select: {
          quantitySold: true,
        },
      });

      if (sales.length < 7) {
        // Not enough data for forecasting
        return Array(daysToForecast).fill(0);
      }

      // Calculate moving average (last 7 days)
      const movingAvgWindow = 7;
      const quantities = sales.map((s) => s.quantitySold);
      const recentAvg =
        quantities.slice(-movingAvgWindow).reduce((sum, q) => sum + q, 0) / movingAvgWindow;

      // Simple forecast: use recent average for all future days
      // In production, would use more sophisticated methods (ARIMA, Prophet, etc.)
      const forecast = Array(daysToForecast).fill(recentAvg);

      logger.info('Demand forecast generated', {
        marketId,
        productId,
        daysToForecast,
        avgDaily: recentAvg,
      });

      return forecast;
    } catch (error) {
      logger.error('Error forecasting demand', { error, marketId, productId });
      return Array(daysToForecast).fill(0);
    }
  }

  /**
   * Detect anomalies in sales patterns
   * Uses simple statistical method (z-score)
   */
  async detectAnomalies(marketId: string, productId: string): Promise<{ isAnomaly: boolean; zScore?: number }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sales = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          productId,
          date: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          quantitySold: true,
        },
      });

      if (sales.length < 7) {
        return { isAnomaly: false };
      }

      const quantities = sales.map((s) => s.quantitySold);
      const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
      const variance =
        quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
      const stdDev = Math.sqrt(variance);

      // Check latest value
      const latest = quantities[quantities.length - 1];
      if (latest === undefined) {
        return { isAnomaly: false };
      }
      const zScore = stdDev > 0 ? (latest - mean) / stdDev : 0;

      // Anomaly if z-score > 2 (more than 2 standard deviations)
      const isAnomaly = Math.abs(zScore) > 2;

      return { isAnomaly, zScore };
    } catch (error) {
      logger.error('Error detecting anomalies', { error, marketId, productId });
      return { isAnomaly: false };
    }
  }
}

export const mlService = new MLService();
