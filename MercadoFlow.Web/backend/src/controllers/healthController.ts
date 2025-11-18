import { Router, Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { HealthCheckResponse } from '../types/api.types';
import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';
import { RedisService } from '../services/RedisService';

const router = Router();
const config = new ConfigService();
const logger = new LoggerService();
const redis = new RedisService();

/**
 * GET /api/v1/health
 * Basic health check
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.get('APP_VERSION', '1.0.0'),
      services: {
        database: 'down',
        redis: 'down',
        api: 'up'
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      response.services.database = 'up';
    } catch (error) {
      logger.error('Health check: Database connection failed', { error });
      response.services.database = 'down';
      response.status = 'unhealthy';
    }

    // Check Redis connection
    try {
      const isRedisHealthy = await redis.ping();
      response.services.redis = isRedisHealthy ? 'up' : 'down';
      if (!isRedisHealthy) {
        response.status = 'unhealthy';
      }
    } catch (error) {
      logger.error('Health check: Redis connection failed', { error });
      response.services.redis = 'down';
      response.status = 'unhealthy';
    }

    const statusCode = response.status === 'healthy' ? 200 : 503;
    const duration = Date.now() - startTime;

    // Log health check if it takes too long or fails
    if (duration > 1000 || response.status === 'unhealthy') {
      logger.warn('Health check completed', {
        status: response.status,
        duration,
        services: response.services
      });
    }

    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Health check error', { error });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.get('APP_VERSION', '1.0.0'),
      services: {
        database: 'down',
        redis: 'down',
        api: 'down'
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/v1/health/detailed
 * Detailed health check with more metrics
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const response: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.get('APP_VERSION', '1.0.0'),
      environment: config.getEnvironment(),
      services: {
        database: 'down',
        redis: 'down',
        api: 'up'
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      },
      database: {
        status: 'down',
        connectionPool: null,
        migrations: null
      },
      redis: {
        status: 'down',
        info: null,
        memory: null
      }
    };

    // Detailed database check
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1 as test`;
      const dbDuration = Date.now() - dbStart;

      response.services.database = 'up';
      response.database = {
        status: 'up',
        responseTime: dbDuration,
        connectionPool: {
          // Add connection pool metrics if available
        }
      };

      // Check if we can query actual tables
      try {
        const userCount = await prisma.user.count();
        const marketCount = await prisma.market.count();
        const invoiceCount = await prisma.invoice.count();

        response.database.stats = {
          users: userCount,
          markets: marketCount,
          invoices: invoiceCount
        };
      } catch (error) {
        response.database.tablesAccessible = false;
      }

    } catch (error) {
      logger.error('Detailed health check: Database failed', { error });
      response.services.database = 'down';
      response.database.status = 'down';
      response.database.error = error instanceof Error ? error.message : 'Unknown error';
      response.status = 'unhealthy';
    }

    // Detailed Redis check
    try {
      const redisStart = Date.now();
      const isRedisHealthy = await redis.ping();
      const redisDuration = Date.now() - redisStart;

      if (isRedisHealthy) {
        response.services.redis = 'up';
        response.redis = {
          status: 'up',
          responseTime: redisDuration
        };

        // Get Redis stats
        try {
          const redisStats = await redis.getStats();
          response.redis.info = redisStats.info;
          response.redis.connected = redisStats.connected;
        } catch (error) {
          // Redis stats not critical for health check
        }
      } else {
        response.services.redis = 'down';
        response.redis.status = 'down';
        response.status = 'unhealthy';
      }

    } catch (error) {
      logger.error('Detailed health check: Redis failed', { error });
      response.services.redis = 'down';
      response.redis.status = 'down';
      response.redis.error = error instanceof Error ? error.message : 'Unknown error';
      response.status = 'unhealthy';
    }

    // Additional system checks
    const totalDuration = Date.now() - startTime;
    response.metrics.healthCheckDuration = totalDuration;

    // Memory threshold check (warn if > 80% of heap limit)
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsagePercent > 80) {
      response.warnings = response.warnings || [];
      response.warnings.push('High memory usage detected');
    }

    // Check if health check itself is slow
    if (totalDuration > 5000) {
      response.warnings = response.warnings || [];
      response.warnings.push('Health check response time is high');
    }

    const statusCode = response.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Detailed health check error', { error });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.get('APP_VERSION', '1.0.0'),
      error: 'Detailed health check failed',
      services: {
        database: 'down',
        redis: 'down',
        api: 'down'
      }
    });
  }
});

/**
 * GET /api/v1/health/ready
 * Readiness probe for Kubernetes/containers
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1 as test`,
      redis.ping()
    ]);

    const dbCheck = checks[0];
    const redisCheck = checks[1];

    const isReady = dbCheck.status === 'fulfilled' &&
                   redisCheck.status === 'fulfilled' &&
                   redisCheck.value === true;

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ready',
          redis: 'ready'
        }
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbCheck.status === 'fulfilled' ? 'ready' : 'not_ready',
          redis: redisCheck.status === 'fulfilled' && redisCheck.value ? 'ready' : 'not_ready'
        }
      });
    }

  } catch (error) {
    logger.error('Readiness check error', { error });

    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
});

/**
 * GET /api/v1/health/live
 * Liveness probe for Kubernetes/containers
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - just verify the process is running
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * GET /api/v1/health/metrics
 * Prometheus-style metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get additional metrics
    let dbConnections = 0;
    let redisConnections = 0;

    try {
      // Database metrics
      const dbResult = await prisma.$queryRaw`SELECT 1 as test`;
      dbConnections = 1; // Simplified - in real implementation, get actual connection count
    } catch {
      dbConnections = 0;
    }

    try {
      // Redis metrics
      const redisHealthy = await redis.ping();
      redisConnections = redisHealthy ? 1 : 0;
    } catch {
      redisConnections = 0;
    }

    // Simple Prometheus-style text format
    const metrics = [
      `# HELP mercadoflow_uptime_seconds Application uptime in seconds`,
      `# TYPE mercadoflow_uptime_seconds gauge`,
      `mercadoflow_uptime_seconds ${process.uptime()}`,
      '',
      `# HELP mercadoflow_memory_usage_bytes Memory usage in bytes`,
      `# TYPE mercadoflow_memory_usage_bytes gauge`,
      `mercadoflow_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
      `mercadoflow_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`,
      `mercadoflow_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`,
      `mercadoflow_memory_usage_bytes{type="external"} ${memUsage.external}`,
      '',
      `# HELP mercadoflow_cpu_usage_microseconds CPU usage in microseconds`,
      `# TYPE mercadoflow_cpu_usage_microseconds gauge`,
      `mercadoflow_cpu_usage_microseconds{type="user"} ${cpuUsage.user}`,
      `mercadoflow_cpu_usage_microseconds{type="system"} ${cpuUsage.system}`,
      '',
      `# HELP mercadoflow_database_connections Active database connections`,
      `# TYPE mercadoflow_database_connections gauge`,
      `mercadoflow_database_connections ${dbConnections}`,
      '',
      `# HELP mercadoflow_redis_connections Active Redis connections`,
      `# TYPE mercadoflow_redis_connections gauge`,
      `mercadoflow_redis_connections ${redisConnections}`,
      ''
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);

  } catch (error) {
    logger.error('Metrics endpoint error', { error });
    res.status(500).send('# Metrics collection failed\n');
  }
});

export default router;