import { PrismaClient } from '@prisma/client';
import { logger } from '@/services/LoggerService';

/**
 * PrismaClient Singleton
 *
 * Prevents multiple instances of PrismaClient which can cause connection pool overflow.
 * Uses global object to persist across hot reloads in development.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: any) => {
      if (logger && typeof logger.database === 'function') {
        logger.database(`Query: ${e.query}`, {
          duration: e.duration,
          params: e.params,
        });
      }
    });
  }

  // Log errors
  client.$on('error', (e: any) => {
    if (logger && typeof logger.error === 'function') {
      logger.error('Prisma Error', { error: e });
    }
  });

  // Log warnings
  client.$on('warn', (e: any) => {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('Prisma Warning', { message: e.message });
    }
  });

  // Log info
  client.$on('info', (e: any) => {
    if (logger && typeof logger.info === 'function') {
      logger.info('Prisma Info', { message: e.message });
    }
  });

  return client;
};

// Use global variable in development to prevent multiple instances during hot reload
export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on process termination
 */
export const disconnectPrisma = async () => {
  await prisma.$disconnect();
  logger.info('Prisma Client disconnected');
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});
