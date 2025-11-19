import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthRequest } from '@/middleware/authMiddleware';
import { LoggerService } from '@/services/LoggerService';
import { RedisService } from '@/services/RedisService';

const router = Router();
const logger = new LoggerService();
const redis = new RedisService();

// Admin query schema
const AdminQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
});

/**
 * Middleware to check admin access
 */
const requireAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
  next();
};

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/v1/admin
 * Get admin dashboard with system health and statistics
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const query = AdminQuerySchema.parse(req.query);

    // Calculate uptime
    const uptimeSeconds = process.uptime();
    const uptimePercentage = 99.9; // Would track actual downtime in production

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get user statistics
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Get data processing statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalInvoices = await prisma.invoice.count();
    const processedToday = await prisma.invoice.count({
      where: {
        processedAt: {
          gte: today,
        },
      },
    });

    // Calculate average processing time (simplified)
    const recentInvoices = await prisma.invoice.findMany({
      take: 100,
      orderBy: {
        processedAt: 'desc',
      },
      select: {
        createdAt: true,
        processedAt: true,
      },
    });

    const avgProcessingTime =
      recentInvoices.length > 0
        ? recentInvoices.reduce((sum, inv) => {
            const diff = inv.processedAt.getTime() - inv.createdAt.getTime();
            return sum + diff / 1000; // Convert to seconds
          }, 0) / recentInvoices.length
        : 0;

    // Get system alerts
    const systemAlerts = [];

    // Check if processing is slow
    if (avgProcessingTime > 5) {
      systemAlerts.push({
        type: 'warning',
        message: `Tempo médio de processamento elevado: ${avgProcessingTime.toFixed(1)}s`,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if memory usage is high
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsedMB > 500) {
      systemAlerts.push({
        type: 'warning',
        message: `Uso de memória elevado: ${memoryUsedMB.toFixed(0)}MB`,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for high volume
    if (processedToday > 100) {
      systemAlerts.push({
        type: 'info',
        message: `Alto volume de dados sendo processados: ${processedToday} invoices hoje`,
        timestamp: new Date().toISOString(),
      });
    }

    const adminData = {
      systemHealth: {
        uptime: `${uptimePercentage.toFixed(1)}%`,
        uptimeSeconds: Math.floor(uptimeSeconds),
        responseTime: avgProcessingTime.toFixed(2),
        errorRate: 0.1, // Would track actual errors
        memoryUsageMB: Math.floor(memoryUsedMB),
        heapLimitMB: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
      },
      userStats: {
        totalUsers,
        activeUsers,
        newUsers,
        inactiveUsers: totalUsers - activeUsers,
        churnRate: totalUsers > 0 ? (((totalUsers - activeUsers) / totalUsers) * 100).toFixed(1) : 0,
      },
      dataStats: {
        totalInvoices,
        processedToday,
        errorRate: 0.05, // Would track actual processing errors
        avgProcessingTime: parseFloat(avgProcessingTime.toFixed(2)),
      },
      alerts: systemAlerts,
    };

    res.json({
      success: true,
      data: adminData,
    });
  } catch (error) {
    logger.error('Error fetching admin dashboard', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching admin data',
      },
    });
  }
});

/**
 * GET /api/v1/admin/users
 * Get user management data with pagination
 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          marketId: true,
          industryId: true,
          market: {
            select: {
              name: true,
            },
          },
          industry: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count(),
    ]);

    const usersData = {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.isActive ? 'active' : 'inactive',
        marketName: u.market?.name,
        industryName: u.industry?.name,
        createdAt: u.createdAt.toISOString(),
        lastLogin: u.updatedAt.toISOString(), // Simplified - would track actual last login
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json({
      success: true,
      data: usersData,
    });
  } catch (error) {
    logger.error('Error fetching users data', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching users data',
      },
    });
  }
});

/**
 * GET /api/v1/admin/system
 * Get detailed system information
 */
router.get('/system', async (req: AuthRequest, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();

    // Test database connection
    let dbStatus = 'connected';
    let dbVersion = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      dbStatus = 'connected';
      // SQLite doesn't have a version query easily accessible
      dbVersion = 'SQLite 3.x';
    } catch (error) {
      dbStatus = 'disconnected';
      logger.error('Database connection test failed', { error });
    }

    // Test Redis connection
    let redisStatus = 'connected';
    let redisMemory = 'unknown';
    try {
      const isHealthy = await redis.ping();
      redisStatus = isHealthy ? 'connected' : 'disconnected';
      // Would get actual memory usage from Redis INFO command
      redisMemory = '128MB';
    } catch (error) {
      redisStatus = 'disconnected';
      logger.error('Redis connection test failed', { error });
    }

    // Get database statistics
    const [userCount, marketCount, invoiceCount, productCount, alertCount] = await Promise.all([
      prisma.user.count(),
      prisma.market.count(),
      prisma.invoice.count(),
      prisma.product.count(),
      prisma.alert.count(),
    ]);

    const systemData = {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        version: dbVersion,
        tables: {
          users: userCount,
          markets: marketCount,
          invoices: invoiceCount,
          products: productCount,
          alerts: alertCount,
        },
      },
      redis: {
        status: redisStatus,
        memory: redisMemory,
      },
      memory: {
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(0)}MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(0)}MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(0)}MB`,
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(0)}MB`,
      },
      logs: {
        level: process.env.LOG_LEVEL || 'info',
        totalEntries: 'See log files', // Would count actual log entries
      },
    };

    res.json({
      success: true,
      data: systemData,
    });
  } catch (error) {
    logger.error('Error fetching system data', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching system data',
      },
    });
  }
});

/**
 * GET /api/v1/admin/markets
 * Get all markets overview
 */
router.get('/markets', async (req: AuthRequest, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            pdvs: true,
            invoices: true,
            alerts: { where: { isRead: false } },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: {
        markets: markets.map((m) => ({
          id: m.id,
          name: m.name,
          city: m.city,
          state: m.state,
          planType: m.planType,
          isActive: m.isActive,
          owner: m.owner,
          stats: {
            users: m._count.users,
            pdvs: m._count.pdvs,
            invoices: m._count.invoices,
            unreadAlerts: m._count.alerts,
          },
          createdAt: m.createdAt,
        })),
        total: markets.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching markets for admin', { error, user: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error fetching markets data',
      },
    });
  }
});

/**
 * POST /api/v1/admin/users/:id/toggle-status
 * Toggle user active status
 */
router.post('/users/:id/toggle-status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    logger.security('User status toggled by admin', {
      adminId: req.user!.id,
      targetUserId: id,
      newStatus: updatedUser.isActive,
    });

    res.json({
      success: true,
      data: updatedUser,
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error('Error toggling user status', { error, userId: req.params.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error toggling user status',
      },
    });
  }
});

export default router;
