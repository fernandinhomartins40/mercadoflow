/**
 * Cron Jobs Entry Point
 *
 * This file starts all scheduled jobs for the MercadoFlow platform.
 * Runs in a separate container to handle background processing.
 */

import { config as dotenvConfig } from 'dotenv';
import { cronJobsService } from './services/CronJobsService';
import { logger, redis, initializeServices } from './lib/services';
import { prisma } from './lib/prisma';

// Load environment variables
dotenvConfig();

async function main() {
  try {
    logger.info('🕐 Starting MercadoFlow Cron Jobs Service...');

    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Initialize services (Redis, etc.)
    await initializeServices();

    // Start all cron jobs
    await cronJobsService.startAll();
    logger.info('✅ All cron jobs started');

    logger.info('🎯 Cron Jobs Service is running');
    logger.info('Schedule:');
    logger.info('  - Daily Aggregation: 02:00 AM');
    logger.info('  - Weekly Market Basket: Sunday 03:00 AM');
    logger.info('  - Hourly Alerts: Every hour :00');
    logger.info('  - Daily Cleanup: 04:00 AM');

  } catch (error) {
    logger.error('Failed to start cron jobs service', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    cronJobsService.stopAll();
    await prisma.$disconnect();
    await redis.disconnect();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the service
main();
