import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { LoggerService } from './LoggerService';
import { mlService } from './MLService';
import { alertService } from './AlertService';

const logger = new LoggerService();

export class CronJobsService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize and start all cron jobs
   */
  async startAll(): Promise<void> {
    try {
      logger.info('Starting cron jobs...');

      // Daily aggregation at 02:00
      this.scheduleDailyAggregation();

      // Weekly market basket analysis (Sunday at 03:00)
      this.scheduleWeeklyMarketBasket();

      // Hourly alert generation
      this.scheduleHourlyAlerts();

      // Daily cleanup (old alerts, logs) at 04:00
      this.scheduleDailyCleanup();

      logger.info('All cron jobs started successfully', {
        jobCount: this.jobs.size,
      });
    } catch (error) {
      logger.error('Error starting cron jobs', { error });
      throw error;
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAll(): void {
    logger.info('Stopping all cron jobs...');

    for (const [name, job] of this.jobs.entries()) {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    }

    this.jobs.clear();
  }

  /**
   * Daily aggregation: Calculate sales analytics for all markets
   * Runs at 02:00 AM every day
   */
  private scheduleDailyAggregation(): void {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running daily aggregation job...');

        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date(yesterday);
        today.setDate(today.getDate() + 1);

        // Get all active markets
        const markets = await prisma.market.findMany({
          where: { isActive: true },
          select: { id: true },
        });

        let totalProcessed = 0;

        for (const market of markets) {
          try {
            const processed = await this.aggregateDailySales(market.id, yesterday, today);
            totalProcessed += processed;
          } catch (error) {
            logger.error('Error aggregating sales for market', {
              error,
              marketId: market.id,
            });
          }
        }

        logger.business('Daily aggregation completed', {
          marketsProcessed: markets.length,
          recordsCreated: totalProcessed,
        });
      } catch (error) {
        logger.error('Error in daily aggregation job', { error });
      }
    });

    this.jobs.set('daily-aggregation', job);
    logger.info('Scheduled daily aggregation job (02:00 AM)');
  }

  /**
   * Aggregate daily sales for a specific market
   */
  private async aggregateDailySales(marketId: string, startDate: Date, endDate: Date): Promise<number> {
    const invoices = await prisma.invoice.findMany({
      where: {
        marketId,
        dataEmissao: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        items: {
          select: {
            productId: true,
            quantidade: true,
            valorTotal: true,
          },
        },
      },
    });

    // Aggregate by product
    const productData = new Map<
      string,
      { quantity: number; revenue: number; transactions: number; totalValue: number }
    >();

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        if (!item.productId) continue;

        const existing = productData.get(item.productId) || {
          quantity: 0,
          revenue: 0,
          transactions: 0,
          totalValue: 0,
        };

        existing.quantity += item.quantidade;
        existing.revenue += item.valorTotal;
        existing.transactions += 1;
        existing.totalValue += item.valorTotal;

        productData.set(item.productId, existing);
      }
    }

    // Store aggregated data
    let created = 0;

    for (const [productId, data] of productData.entries()) {
      try {
        await prisma.salesAnalytics.upsert({
          where: {
            marketId_productId_date: {
              marketId,
              productId,
              date: startDate,
            },
          },
          update: {
            quantitySold: data.quantity,
            revenue: data.revenue,
            averagePrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
            transactionCount: data.transactions,
          },
          create: {
            marketId,
            productId,
            date: startDate,
            quantitySold: data.quantity,
            revenue: data.revenue,
            averagePrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
            transactionCount: data.transactions,
          },
        });

        created++;
      } catch (error) {
        logger.error('Error upserting sales analytics', {
          error,
          marketId,
          productId,
        });
      }
    }

    return created;
  }

  /**
   * Weekly market basket analysis
   * Runs every Sunday at 03:00 AM
   */
  private scheduleWeeklyMarketBasket(): void {
    const job = cron.schedule('0 3 * * 0', async () => {
      try {
        logger.info('Running weekly market basket analysis...');

        const markets = await prisma.market.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        let totalAssociations = 0;

        for (const market of markets) {
          try {
            const result = await mlService.analyzeAndStoreMarketBasket(market.id);
            totalAssociations += result.stored;

            logger.business('Market basket analysis completed for market', {
              marketId: market.id,
              marketName: market.name,
              associationsFound: result.associationsFound,
              stored: result.stored,
            });
          } catch (error) {
            logger.error('Error running market basket for market', {
              error,
              marketId: market.id,
            });
          }
        }

        logger.business('Weekly market basket analysis completed', {
          marketsProcessed: markets.length,
          totalAssociations,
        });
      } catch (error) {
        logger.error('Error in weekly market basket job', { error });
      }
    });

    this.jobs.set('weekly-market-basket', job);
    logger.info('Scheduled weekly market basket job (Sunday 03:00 AM)');
  }

  /**
   * Hourly alert generation
   * Runs every hour at :00
   */
  private scheduleHourlyAlerts(): void {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running hourly alert generation...');

        const markets = await prisma.market.findMany({
          where: { isActive: true },
          select: { id: true },
        });

        let totalAlerts = 0;

        for (const market of markets) {
          try {
            const alertsCreated = await alertService.generateAlertsForMarket(market.id);
            totalAlerts += alertsCreated;
          } catch (error) {
            logger.error('Error generating alerts for market', {
              error,
              marketId: market.id,
            });
          }
        }

        logger.business('Hourly alert generation completed', {
          marketsProcessed: markets.length,
          totalAlertsCreated: totalAlerts,
        });
      } catch (error) {
        logger.error('Error in hourly alert generation job', { error });
      }
    });

    this.jobs.set('hourly-alerts', job);
    logger.info('Scheduled hourly alert generation (every hour)');
  }

  /**
   * Daily cleanup: Remove old read alerts and logs
   * Runs at 04:00 AM every day
   */
  private scheduleDailyCleanup(): void {
    const job = cron.schedule('0 4 * * *', async () => {
      try {
        logger.info('Running daily cleanup job...');

        // Cleanup old alerts (30+ days, read)
        const alertsDeleted = await alertService.cleanupOldAlerts();

        // Cleanup old audit logs (90+ days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const logsDeleted = await prisma.auditLog.deleteMany({
          where: {
            createdAt: {
              lt: ninetyDaysAgo,
            },
          },
        });

        logger.business('Daily cleanup completed', {
          alertsDeleted,
          logsDeleted: logsDeleted.count,
        });
      } catch (error) {
        logger.error('Error in daily cleanup job', { error });
      }
    });

    this.jobs.set('daily-cleanup', job);
    logger.info('Scheduled daily cleanup job (04:00 AM)');
  }

  /**
   * Manual trigger for testing - runs all jobs immediately
   */
  async runAllNow(): Promise<void> {
    logger.info('Manually triggering all cron jobs...');

    try {
      // Get yesterday for aggregation
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      const markets = await prisma.market.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const market of markets) {
        // Run aggregation
        await this.aggregateDailySales(market.id, yesterday, today);

        // Run market basket
        await mlService.analyzeAndStoreMarketBasket(market.id);

        // Generate alerts
        await alertService.generateAlertsForMarket(market.id);
      }

      logger.info('All jobs executed manually');
    } catch (error) {
      logger.error('Error running jobs manually', { error });
      throw error;
    }
  }
}

export const cronJobsService = new CronJobsService();
