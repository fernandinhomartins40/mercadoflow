import { RedisService } from '../services/RedisService';
import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';

/**
 * Service Singletons
 *
 * Shared instances of core services to prevent multiple instantiations
 * and ensure proper connection management across the application.
 */

declare global {
  // eslint-disable-next-line no-var
  var __configService: ConfigService | undefined;
  // eslint-disable-next-line no-var
  var __loggerService: LoggerService | undefined;
  // eslint-disable-next-line no-var
  var __redisService: RedisService | undefined;
}

// Config Service Singleton
const configServiceSingleton = () => {
  return new ConfigService();
};

export const config = globalThis.__configService ?? configServiceSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__configService = config;
}

// Logger Service Singleton
const loggerServiceSingleton = () => {
  return new LoggerService();
};

export const logger = globalThis.__loggerService ?? loggerServiceSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__loggerService = logger;
}

// Redis Service Singleton
const redisServiceSingleton = () => {
  return new RedisService();
};

export const redis = globalThis.__redisService ?? redisServiceSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redisService = redis;
}

/**
 * Initialize all services
 * This function should be called during application startup
 */
export async function initializeServices() {
  logger.info('Initializing services...');

  try {
    // Connect to Redis
    await redis.connect();
    logger.info('✓ Redis connected successfully');
  } catch (error) {
    logger.error('✗ Redis connection failed', { error });
    logger.warn('⚠ Continuing without Redis (some features may be limited)');
  }
}

/**
 * Gracefully disconnect all services
 */
export async function disconnectServices() {
  logger.info('Disconnecting services...');

  try {
    await redis.disconnect();
    logger.info('✓ Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis', { error });
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectServices();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectServices();
  process.exit(0);
});
