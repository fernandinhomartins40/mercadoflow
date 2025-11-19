import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import rateLimit from 'express-rate-limit';

import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  ChangePasswordRequest,
  UserInfo,
  JwtPayload
} from '../types/auth.types';
import { ApiResponse } from '../types/api.types';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError } from '../types/common.types';
import { ConfigService } from '../services/ConfigService';
import { LoggerService } from '../services/LoggerService';
import { RedisService } from '../services/RedisService';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();
const config = new ConfigService();
const logger = new LoggerService();
const redis = new RedisService();

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'MARKET_OWNER', 'MARKET_MANAGER', 'INDUSTRY_USER']),
  marketId: z.string().uuid().optional(),
  industryId: z.string().uuid().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

// Helper functions
async function generateTokens(user: UserInfo): Promise<{ token: string; refreshToken: string }> {
  const jwtSecret = config.getJwtSecret();
  const jwtExpiresIn = config.getJwtExpiresIn();

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    marketId: user.marketId,
    industryId: user.industryId
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn || '1h' });
  const refreshToken = jwt.sign(payload, jwtSecret, { expiresIn: '30d' });

  // Store refresh token in Redis
  await redis.set(`refresh_token:${user.id}`, refreshToken, 30 * 24 * 60 * 60); // 30 days

  return { token, refreshToken };
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = config.get('BCRYPT_ROUNDS', 12);
  return bcrypt.hash(password, saltRounds);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function createUserInfo(user: any): UserInfo {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    marketId: user.marketId || undefined,
    industryId: user.industryId || undefined,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

// Routes

/**
 * POST /api/v1/auth/login
 * User login
 */
router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        market: true,
        industry: true
      }
    });

    if (!user) {
      logger.security('Login attempt with non-existent email', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      logger.security('Login attempt with disabled account', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.security('Login attempt with invalid password', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const userInfo = createUserInfo(user);
    const { token, refreshToken } = await generateTokens(userInfo);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });

    // Log successful login
    logger.events.userLogin(user.id, user.email, req.ip || 'unknown');

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: userInfo,
        token,
        refreshToken,
        expiresIn: jwt.decode(token) ? (jwt.decode(token) as any).exp - Math.floor(Date.now() / 1000) : 3600
      }
    };

    res.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors
        }
      });
    }

    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message
        }
      });
    }

    logger.error('Login error', { error, email: req.body.email });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed'
      }
    });
  }
});

/**
 * POST /api/v1/auth/register
 * User registration (admin only in production)
 */
router.post('/register', generalRateLimit, async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name, role, marketId, industryId } = validatedData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Validate role-specific requirements
    if (role === 'MARKET_OWNER' || role === 'MARKET_MANAGER') {
      if (!marketId) {
        throw new ValidationError('Market ID is required for market users');
      }

      // Verify market exists
      const market = await prisma.market.findUnique({
        where: { id: marketId }
      });

      if (!market) {
        throw new NotFoundError('Market not found');
      }
    }

    if (role === 'INDUSTRY_USER') {
      if (!industryId) {
        throw new ValidationError('Industry ID is required for industry users');
      }

      // Verify industry exists
      const industry = await prisma.industry.findUnique({
        where: { id: industryId }
      });

      if (!industry) {
        throw new NotFoundError('Industry not found');
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role,
        marketId: marketId || null,
        industryId: industryId || null,
        isActive: true
      },
      include: {
        market: true,
        industry: true
      }
    });

    // Generate tokens
    const userInfo = createUserInfo(user);
    const { token, refreshToken } = await generateTokens(userInfo);

    logger.business('User registered', {
      userId: user.id,
      email: user.email,
      role: user.role,
      marketId: user.marketId,
      industryId: user.industryId
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: userInfo,
        token,
        refreshToken,
        expiresIn: jwt.decode(token) ? (jwt.decode(token) as any).exp - Math.floor(Date.now() / 1000) : 3600
      }
    };

    res.status(201).json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors
        }
      });
    }

    if (error instanceof ConflictError || error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Registration error', { error, email: req.body.email });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed'
      }
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', generalRateLimit, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    // Verify refresh token
    const jwtSecret = config.getJwtSecret();
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(refreshToken, jwtSecret) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if refresh token exists in Redis
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
    if (storedToken !== refreshToken) {
      throw new UnauthorizedError('Refresh token not found or expired');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        market: true,
        industry: true
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate new tokens
    const userInfo = createUserInfo(user);
    const tokens = await generateTokens(userInfo);

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: userInfo,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresIn: jwt.decode(tokens.token) ? (jwt.decode(tokens.token) as any).exp - Math.floor(Date.now() / 1000) : 3600
      }
    };

    res.json(response);

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message
        }
      });
    }

    logger.error('Token refresh error', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Token refresh failed'
      }
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * User logout
 */
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer '

    if (token) {
      // Add token to blacklist with individual expiration
      const decoded = jwt.decode(token) as any;
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

      if (expiresIn > 0) {
        // Store token with its own expiration (Redis string with TTL)
        const tokenKey = `blacklist:token:${token}`;
        await redis.set(tokenKey, '1', expiresIn);
      }
    }

    // Remove refresh token
    await redis.del(`refresh_token:${user.id}`);

    logger.events.userLogout(user.id, user.email);

    const response: ApiResponse = {
      success: true,
      message: 'Logged out successfully'
    };

    res.json(response);

  } catch (error) {
    logger.error('Logout error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed'
      }
    });
  }
});

/**
 * GET /api/v1/auth/profile
 * Get current user profile
 */
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    // Get fresh user data
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        market: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            planType: true
          }
        },
        industry: {
          select: {
            id: true,
            name: true,
            segment: true
          }
        }
      }
    });

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    const response: ApiResponse<UserInfo & { market?: any; industry?: any }> = {
      success: true,
      data: {
        ...createUserInfo(userData),
        market: userData.market,
        industry: userData.industry
      }
    };

    res.json(response);

  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    }

    logger.error('Profile fetch error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile'
      }
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile (alias for /profile)
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    // Get fresh user data
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        market: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            planType: true
          }
        },
        industry: {
          select: {
            id: true,
            name: true,
            segment: true
          }
        }
      }
    });

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    const response: ApiResponse<UserInfo & { market?: any; industry?: any }> = {
      success: true,
      data: {
        ...createUserInfo(userData),
        market: userData.market,
        industry: userData.industry
      }
    };

    res.json(response);

  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      });
    }

    logger.error('Profile fetch error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile'
      }
    });
  }
});

/**
 * PUT /api/v1/auth/change-password
 * Change user password
 */
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const validatedData = changePasswordSchema.parse(req.body);
    const { currentPassword, newPassword } = validatedData;

    // Get user with password
    const userData = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!userData) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, userData.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });

    // Invalidate all existing tokens
    await redis.del(`refresh_token:${user.id}`);

    logger.business('Password changed', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    const response: ApiResponse = {
      success: true,
      message: 'Password changed successfully'
    };

    res.json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors
        }
      });
    }

    if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    logger.error('Change password error', { error, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to change password'
      }
    });
  }
});

export default router;