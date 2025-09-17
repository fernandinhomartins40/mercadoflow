import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/authMiddleware';

// Import routes
import authRoutes from './controllers/authController';
import ingestRoutes from './controllers/ingestController';
import dashboardRoutes from './controllers/dashboardController';
import marketRoutes from './controllers/marketController';
import industryRoutes from './controllers/industryController';
import adminRoutes from './controllers/adminController';
import healthRoutes from './controllers/healthController';

// Import services
import { RedisService } from './services/RedisService';
import { ConfigService } from './services/ConfigService';
import { LoggerService } from './services/LoggerService';

// Initialize services
const config = new ConfigService();
const logger = new LoggerService();
const prisma = new PrismaClient();
const redis = new RedisService();

// Create Express app
const app = express();
const server = createServer(app);

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: config.get('CORS_ORIGIN', 'http://localhost:3001').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Agent-Version', 'X-Market-ID'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Body parsing
app.use(express.json({
  limit: config.get('MAX_FILE_SIZE', '50mb'),
  verify: (req, res, buf) => {
    // Store raw body for webhook verification
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: config.get('MAX_FILE_SIZE', '50mb')
}));

// Rate limiting
const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.'
        }
      });
    }
  });
};

// Global rate limiting
app.use(createRateLimit(
  config.get('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  config.get('RATE_LIMIT_MAX_REQUESTS', 100)
));

// Request logging
app.use(requestLogger);

// Health check (before auth middleware)
app.use('/api/v1/health', healthRoutes);

// API routes with authentication
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ingest', authMiddleware, ingestRoutes);
app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/v1/markets', authMiddleware, marketRoutes);
app.use('/api/v1/industries', authMiddleware, industryRoutes);
app.use('/api/v1/admin', authMiddleware, adminRoutes);

// API documentation
app.get('/api/v1/docs', (req, res) => {
  res.json({
    name: 'MercadoFlow Intelligence API',
    version: '1.0.0',
    description: 'API completa para análise de dados de vendas de supermercados',
    endpoints: {
      auth: '/api/v1/auth',
      ingest: '/api/v1/ingest',
      dashboard: '/api/v1/dashboard',
      markets: '/api/v1/markets',
      industries: '/api/v1/industries',
      admin: '/api/v1/admin',
      health: '/api/v1/health'
    },
    documentation: 'https://docs.mercadoflow.com/api'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      await redis.disconnect();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Start server
const PORT = config.get('PORT', 3000);
const HOST = config.get('HOST', '0.0.0.0');

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Test Redis connection
    await redis.connect();
    logger.info('Redis connected successfully');

    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 MercadoFlow API server running on ${HOST}:${PORT}`);
      logger.info(`📚 API Documentation: http://${HOST}:${PORT}/api/v1/docs`);
      logger.info(`💓 Health Check: http://${HOST}:${PORT}/api/v1/health`);
      logger.info(`🌍 Environment: ${config.get('NODE_ENV', 'development')}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { app, server, prisma, redis, logger, config };