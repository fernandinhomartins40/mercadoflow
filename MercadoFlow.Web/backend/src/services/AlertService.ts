import { prisma } from '@/lib/prisma';
import { LoggerService } from './LoggerService';

const logger = new LoggerService();

export type AlertType = 'LOW_STOCK' | 'HIGH_PERFORMING' | 'SLOW_MOVING' | 'EXPIRATION_RISK' | 'PROMOTION_OPPORTUNITY';
export type AlertPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AlertRule {
  type: AlertType;
  condition: (data: any) => boolean;
  generateMessage: (data: any) => { title: string; message: string; priority: AlertPriority };
}

export class AlertService {
  /**
   * Generate alerts for a market based on rules
   */
  async generateAlertsForMarket(marketId: string): Promise<number> {
    try {
      logger.info('Generating alerts for market', { marketId });

      let alertsCreated = 0;

      // Check for low stock products
      alertsCreated += await this.checkLowStock(marketId);

      // Check for slow moving products
      alertsCreated += await this.checkSlowMoving(marketId);

      // Check for high performing products
      alertsCreated += await this.checkHighPerforming(marketId);

      logger.business('Alerts generated for market', { marketId, alertsCreated });

      return alertsCreated;
    } catch (error) {
      logger.error('Error generating alerts', { error, marketId });
      throw error;
    }
  }

  /**
   * Check for low stock products
   * Rule: Sales in last 7 days * 4 > estimated stock turnover
   */
  private async checkLowStock(marketId: string): Promise<number> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get products with high recent sales
      const recentSales = await prisma.salesAnalytics.findMany({
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

      // Aggregate by product
      const productSales = new Map<string, { name: string; quantity: number }>();

      for (const sale of recentSales) {
        const existing = productSales.get(sale.productId) || { name: sale.product.name, quantity: 0 };
        existing.quantity += sale.quantitySold;
        productSales.set(sale.productId, existing);
      }

      let created = 0;

      // Create alerts for products with high turnover (potential low stock)
      for (const [productId, data] of productSales.entries()) {
        // Simple heuristic: if selling more than 50 units per week, flag as potential low stock
        if (data.quantity > 50) {
          // Check if alert already exists
          const existingAlert = await prisma.alert.findFirst({
            where: {
              marketId,
              productId,
              type: 'LOW_STOCK',
              isRead: false,
              createdAt: {
                gte: sevenDaysAgo,
              },
            },
          });

          if (!existingAlert) {
            await prisma.alert.create({
              data: {
                marketId,
                productId,
                type: 'LOW_STOCK',
                title: `Estoque Baixo - ${data.name}`,
                message: `Vendas aceleradas detectadas (${data.quantity.toFixed(0)} unidades nos últimos 7 dias). Verifique o estoque.`,
                priority: data.quantity > 100 ? 'HIGH' : 'MEDIUM',
                isRead: false,
              },
            });
            created++;
          }
        }
      }

      return created;
    } catch (error) {
      logger.error('Error checking low stock', { error, marketId });
      return 0;
    }
  }

  /**
   * Check for slow moving products
   * Rule: Zero sales in last 30 days
   */
  private async checkSlowMoving(marketId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get all products that have been sold at some point
      const allProductIds = await prisma.invoiceItem.findMany({
        where: {
          invoice: {
            marketId,
          },
        },
        select: {
          productId: true,
        },
        distinct: ['productId'],
      });

      // Get products with recent sales
      const recentSales = await prisma.salesAnalytics.findMany({
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

      const recentProductIds = new Set(recentSales.map((s) => s.productId));
      const slowMovingIds = allProductIds.filter((p) => p.productId && !recentProductIds.has(p.productId)).map((p) => p.productId!);

      let created = 0;

      for (const productId of slowMovingIds.slice(0, 10)) {
        // Limit to top 10
        // Check if alert already exists
        const existingAlert = await prisma.alert.findFirst({
          where: {
            marketId,
            productId,
            type: 'SLOW_MOVING',
            isRead: false,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        });

        if (!existingAlert) {
          const product = await prisma.product.findUnique({
            where: { id: productId },
          });

          if (product) {
            await prisma.alert.create({
              data: {
                marketId,
                productId,
                type: 'SLOW_MOVING',
                title: `Produto Parado - ${product.name}`,
                message: `Sem vendas nos últimos 30 dias. Considere promoção ou descontinuação.`,
                priority: 'MEDIUM',
                isRead: false,
              },
            });
            created++;
          }
        }
      }

      return created;
    } catch (error) {
      logger.error('Error checking slow moving', { error, marketId });
      return 0;
    }
  }

  /**
   * Check for high performing products
   * Rule: Growth > 30% compared to previous period
   */
  private async checkHighPerforming(marketId: string): Promise<number> {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Get sales for last 7 days
      const recentSales = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: sevenDaysAgo,
          },
        },
      });

      // Get sales for previous 7 days
      const previousSales = await prisma.salesAnalytics.findMany({
        where: {
          marketId,
          date: {
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo,
          },
        },
      });

      // Aggregate by product
      const recentByProduct = new Map<string, number>();
      const previousByProduct = new Map<string, number>();

      for (const sale of recentSales) {
        recentByProduct.set(sale.productId, (recentByProduct.get(sale.productId) || 0) + sale.revenue);
      }

      for (const sale of previousSales) {
        previousByProduct.set(sale.productId, (previousByProduct.get(sale.productId) || 0) + sale.revenue);
      }

      let created = 0;

      // Find products with significant growth
      for (const [productId, recentRevenue] of recentByProduct.entries()) {
        const previousRevenue = previousByProduct.get(productId) || 0;

        if (previousRevenue > 0) {
          const growthRate = ((recentRevenue - previousRevenue) / previousRevenue) * 100;

          if (growthRate > 30 && recentRevenue > 100) {
            // Growth > 30% and revenue > 100
            // Check if alert already exists
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const existingAlert = await prisma.alert.findFirst({
              where: {
                marketId,
                productId,
                type: 'HIGH_PERFORMING',
                isRead: false,
                createdAt: {
                  gte: twoDaysAgo,
                },
              },
            });

            if (!existingAlert) {
              const product = await prisma.product.findUnique({
                where: { id: productId },
              });

              if (product) {
                await prisma.alert.create({
                  data: {
                    marketId,
                    productId,
                    type: 'HIGH_PERFORMING',
                    title: `Produto em Alta - ${product.name}`,
                    message: `Crescimento de ${growthRate.toFixed(1)}% nas vendas esta semana. Considere aumentar estoque.`,
                    priority: growthRate > 50 ? 'HIGH' : 'MEDIUM',
                    isRead: false,
                  },
                });
                created++;
              }
            }
          }
        }
      }

      return created;
    } catch (error) {
      logger.error('Error checking high performing', { error, marketId });
      return 0;
    }
  }

  /**
   * Get unread alerts for a market
   */
  async getUnreadAlerts(marketId: string, limit?: number): Promise<any[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          marketId,
          isRead: false,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              ean: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        ...(limit !== undefined && { take: limit }),
      });

      return alerts;
    } catch (error) {
      logger.error('Error getting unread alerts', { error, marketId });
      throw error;
    }
  }

  /**
   * Mark alert as read
   */
  async markAsRead(alertId: string): Promise<void> {
    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: { isRead: true },
      });
    } catch (error) {
      logger.error('Error marking alert as read', { error, alertId });
      throw error;
    }
  }

  /**
   * Delete old read alerts (older than 30 days)
   */
  async cleanupOldAlerts(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.alert.deleteMany({
        where: {
          isRead: true,
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      logger.info('Old alerts cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old alerts', { error });
      return 0;
    }
  }
}

export const alertService = new AlertService();
