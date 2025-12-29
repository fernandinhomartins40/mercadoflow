import { Router, Request, Response } from 'express';
import { config, logger } from '@/lib/services';

const router = Router();

router.get('/logs', (req: Request, res: Response) => {
  const enabled = config.get('PUBLIC_LOGS_ENABLED', true);
  if (!enabled) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }

  const token = config.get('PUBLIC_LOGS_TOKEN', '');
  if (token && req.query.token !== token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid token'
      }
    });
  }

  const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 1000);
  const level = req.query.level ? String(req.query.level) : undefined;
  const contains = req.query.contains ? String(req.query.contains) : undefined;
  const since = req.query.since ? String(req.query.since) : undefined;

  const logs = logger.getRecentLogs({ limit, level, contains, since });

  return res.json({
    success: true,
    data: {
      count: logs.length,
      logs
    }
  });
});

router.delete('/logs', (req: Request, res: Response) => {
  const enabled = config.get('PUBLIC_LOGS_ENABLED', true);
  if (!enabled) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      }
    });
  }

  const token = config.get('PUBLIC_LOGS_TOKEN', '');
  if (token && req.query.token !== token) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid token'
      }
    });
  }

  logger.clearRecentLogs();

  return res.json({
    success: true,
    data: {
      message: 'Logs cleared'
    }
  });
});

export default router;
