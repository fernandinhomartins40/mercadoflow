import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config, logger } from '@/lib/services';

interface RequestWithId extends Request {
  id?: string;
  startTime?: number;
}

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.set('X-Request-ID', req.id);

  // Extract relevant request information
  const requestInfo = {
    requestId: req.id,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  };

  // Log incoming request
  if (shouldLogRequest(req)) {
    logger.http('Incoming request', requestInfo);
  }

  // Capture response size without storing body (prevents memory leak)
  let responseSize = 0;
  const originalSend = res.send;

  res.send = function(body: any) {
    // Calculate size without storing the entire body
    if (body) {
      if (typeof body === 'string') {
        responseSize = Buffer.byteLength(body);
      } else if (Buffer.isBuffer(body)) {
        responseSize = body.length;
      } else {
        // For objects, estimate size (avoid JSON.stringify for large objects)
        responseSize = 0;
      }
    }
    return originalSend.call(this, body);
  };

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);

    const responseInfo = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      responseSize: parseInt(res.get('Content-Length') || '0') || responseSize,
      ip: getClientIP(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Include user info if available
    const user = (req as any).user;
    if (user) {
      (responseInfo as any).userId = user.id;
      (responseInfo as any).userEmail = user.email;
      (responseInfo as any).userRole = user.role;
    }

    // Log based on status code and duration
    if (shouldLogResponse(req, res, duration)) {
      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', responseInfo);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', responseInfo);
      } else if (duration > 5000) {
        logger.warn('Slow request completed', responseInfo);
      } else {
        logger.http('Request completed', responseInfo);
      }
    }

    // Log security events
    if (isSecurityRelevant(req, res)) {
      logger.security('Security relevant request', {
        ...responseInfo,
        securityEvent: getSecurityEventType(req, res)
      });
    }

    // Log business events
    if (isBusinessRelevant(req, res)) {
      logger.business('Business event', {
        ...responseInfo,
        businessEvent: getBusinessEventType(req, res)
      });
    }
  });

  // Log errors
  res.on('error', (error) => {
    const duration = Date.now() - (req.startTime || 0);

    logger.error('Request error', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      duration,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ip: getClientIP(req),
      timestamp: new Date().toISOString()
    });
  });

  next();
};

function getClientIP(req: Request): string {
  return (
    req.get('CF-Connecting-IP') ||
    req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function shouldLogRequest(req: Request): boolean {
  // Skip logging for health checks and static assets
  const skipPaths = [
    '/api/v1/health',
    '/favicon.ico',
    '/robots.txt'
  ];

  // Skip logging for certain paths in production
  if (config.isProduction()) {
    skipPaths.push('/metrics');
  }

  return !skipPaths.some(path => req.path.startsWith(path));
}

function shouldLogResponse(req: Request, res: Response, duration: number): boolean {
  // Always log errors and slow requests
  if (res.statusCode >= 400 || duration > 1000) {
    return true;
  }

  // Skip logging for health checks and static assets
  const skipPaths = [
    '/api/v1/health',
    '/favicon.ico',
    '/robots.txt'
  ];

  // In production, only log business-relevant requests
  if (config.isProduction()) {
    const businessPaths = [
      '/api/v1/auth',
      '/api/v1/ingest',
      '/api/v1/dashboard',
      '/api/v1/markets',
      '/api/v1/industries',
      '/api/v1/admin'
    ];

    return businessPaths.some(path => req.path.startsWith(path)) &&
           !skipPaths.some(path => req.path.startsWith(path));
  }

  // In development, log everything except skipped paths
  return !skipPaths.some(path => req.path.startsWith(path));
}

function isSecurityRelevant(req: Request, res: Response): boolean {
  // Authentication attempts
  if (req.path.includes('/auth/')) {
    return true;
  }

  // Failed authorization
  if (res.statusCode === 401 || res.statusCode === 403) {
    return true;
  }

  // Admin actions
  if (req.path.startsWith('/api/v1/admin/')) {
    return true;
  }

  // Rate limit exceeded
  if (res.statusCode === 429) {
    return true;
  }

  // Suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /drop.*table/i,  // SQL injection
    /exec\(/i,  // Code execution
    /eval\(/i   // Code execution
  ];

  const urlParams = req.url + JSON.stringify(req.body || {});
  return suspiciousPatterns.some(pattern => pattern.test(urlParams));
}

function getSecurityEventType(req: Request, res: Response): string {
  if (req.path.includes('/auth/login')) {
    return res.statusCode === 200 ? 'login_success' : 'login_failure';
  }

  if (req.path.includes('/auth/logout')) {
    return 'logout';
  }

  if (res.statusCode === 401) {
    return 'unauthorized_access';
  }

  if (res.statusCode === 403) {
    return 'forbidden_access';
  }

  if (res.statusCode === 429) {
    return 'rate_limit_exceeded';
  }

  return 'security_event';
}

function isBusinessRelevant(req: Request, res: Response): boolean {
  // Successful data ingestion
  if (req.path.startsWith('/api/v1/ingest/') && res.statusCode === 200) {
    return true;
  }

  // User management
  if (req.path.startsWith('/api/v1/admin/users') && req.method !== 'GET') {
    return true;
  }

  // Market management
  if (req.path.startsWith('/api/v1/markets') && req.method !== 'GET') {
    return true;
  }

  // Campaign management
  if (req.path.includes('/campaigns') && req.method !== 'GET') {
    return true;
  }

  return false;
}

function getBusinessEventType(req: Request, res: Response): string {
  if (req.path.startsWith('/api/v1/ingest/invoice')) {
    return 'invoice_ingested';
  }

  if (req.path.includes('/users') && req.method === 'POST') {
    return 'user_created';
  }

  if (req.path.includes('/markets') && req.method === 'POST') {
    return 'market_created';
  }

  if (req.path.includes('/campaigns') && req.method === 'POST') {
    return 'campaign_created';
  }

  return 'business_event';
}

// Performance monitoring middleware
export const performanceMonitor = (req: RequestWithId, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    // Log slow requests or high memory usage
    if (duration > 1000 || Math.abs(memoryDelta.heapUsed) > 10 * 1024 * 1024) { // 10MB
      logger.performance('Performance metrics', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration,
        memoryDelta,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

// Rate limiting logger
export const rateLimitLogger = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;

  res.json = function(body: any) {
    if (res.statusCode === 429) {
      logger.security('Rate limit exceeded', {
        ip: getClientIP(req),
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }

    return originalJson.call(this, body);
  };

  next();
};