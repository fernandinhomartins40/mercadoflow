import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '../types/common.types';
import { JwtPayload, UserInfo } from '../types/auth.types';
import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';
import { RedisService } from '../services/RedisService';

const prisma = new PrismaClient();
const config = new ConfigService();
const logger = new LoggerService();
const redis = new RedisService();

export interface AuthRequest extends Request {
  user?: UserInfo;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await redis.sismember('blacklisted_tokens', token);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify JWT token
    const jwtSecret = config.getJwtSecret();
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      } else {
        throw new UnauthorizedError('Token verification failed');
      }
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        market: true,
        industry: true
      }
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is disabled');
    }

    // Create user info object
    const userInfo: UserInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      marketId: user.marketId || undefined,
      industryId: user.industryId || undefined,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    // Attach user to request
    req.user = userInfo;

    // Log successful authentication
    logger.debug('User authenticated', {
      userId: user.id,
      email: user.email,
      role: user.role,
      endpoint: req.path
    });

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      logger.security('Authentication failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message
        }
      });
    }

    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : error,
      ip: req.ip,
      endpoint: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error'
      }
    });
  }
};

// Role-based access control middleware
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
};

// Market ownership middleware
export const requireMarketAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const marketId = req.params.marketId || req.query.marketId || req.body.marketId;

    if (!marketId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Market ID required'
        }
      });
    }

    // Admin can access any market
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user has access to this market
    if (req.user.role === 'MARKET_OWNER' || req.user.role === 'MARKET_MANAGER') {
      if (req.user.marketId !== marketId) {
        logger.security('Market access denied', {
          userId: req.user.id,
          userMarketId: req.user.marketId,
          requestedMarketId: marketId,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this market'
          }
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Market access middleware error', {
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id,
      endpoint: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Access control error'
      }
    });
  }
};

// Industry access middleware
export const requireIndustryAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const industryId = req.params.industryId || req.query.industryId || req.body.industryId;

    if (!industryId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Industry ID required'
        }
      });
    }

    // Admin can access any industry
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user has access to this industry
    if (req.user.role === 'INDUSTRY_USER') {
      if (req.user.industryId !== industryId) {
        logger.security('Industry access denied', {
          userId: req.user.id,
          userIndustryId: req.user.industryId,
          requestedIndustryId: industryId,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this industry'
          }
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Industry access middleware error', {
      error: error instanceof Error ? error.message : error,
      userId: req.user?.id,
      endpoint: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Access control error'
      }
    });
  }
};

// Optional authentication middleware (for public endpoints that can use auth)
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // If optional auth fails, continue without user
    next();
  }
};

// API Key authentication (for external integrations)
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedError('API key required');
    }

    // Validate API key (you can implement your own logic here)
    const hashedKey = await redis.get(`api_key:${apiKey}`);

    if (!hashedKey) {
      throw new UnauthorizedError('Invalid API key');
    }

    // You can add more API key validation logic here
    // For example, check rate limits, permissions, etc.

    logger.debug('API key authenticated', {
      apiKey: apiKey.substring(0, 8) + '...',
      endpoint: req.path
    });

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      logger.security('API key authentication failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message
        }
      });
    }

    logger.error('API key middleware error', {
      error: error instanceof Error ? error.message : error,
      endpoint: req.path
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'API key validation error'
      }
    });
  }
};