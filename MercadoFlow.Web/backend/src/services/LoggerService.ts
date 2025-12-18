import winston from 'winston';
import { Logger as ILogger } from '../types/common.types';
import { ConfigService } from './ConfigService';

export class LoggerService implements ILogger {
  private logger: winston.Logger;
  private config: ConfigService;

  constructor() {
    this.config = new ConfigService();
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logLevel = this.config.get('LOG_LEVEL', 'info');
    const logFormat = this.config.get('LOG_FORMAT', 'json');
    const isProduction = this.config.isProduction();

    // Custom format for JSON logging
    const jsonFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ['timestamp', 'level', 'message']
      }),
      winston.format.json()
    );

    // Custom format for console logging
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}] ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta, null, 2)}`;
        }
        return log;
      })
    );

    // Create transports
    const transports: winston.transport[] = [];

    // Console transport (always enabled in development)
    if (!isProduction || this.config.get('LOG_CONSOLE', false)) {
      transports.push(
        new winston.transports.Console({
          level: logLevel,
          format: logFormat === 'json' ? jsonFormat : consoleFormat
        })
      );
    }

    // File transports
    if (isProduction || this.config.get('LOG_FILES', true)) {
      // All logs file
      transports.push(
        new winston.transports.File({
          filename: './logs/mercadoflow.log',
          level: logLevel,
          format: jsonFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Error logs file
      transports.push(
        new winston.transports.File({
          filename: './logs/mercadoflow-error.log',
          level: 'error',
          format: jsonFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Access logs file (for HTTP requests)
      transports.push(
        new winston.transports.File({
          filename: './logs/mercadoflow-access.log',
          level: 'info',
          format: jsonFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      transports,
      // Don't exit on handled exceptions
      exitOnError: false,
      // Handle uncaught exceptions
      exceptionHandlers: isProduction ? [
        new winston.transports.File({
          filename: './logs/mercadoflow-exceptions.log',
          format: jsonFormat
        })
      ] : [],
      // Handle unhandled promise rejections
      rejectionHandlers: isProduction ? [
        new winston.transports.File({
          filename: './logs/mercadoflow-rejections.log',
          format: jsonFormat
        })
      ] : []
    });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  fatal(message: string, meta?: any): void {
    this.logger.error(message, { ...meta, fatal: true });
  }

  // HTTP request logging
  http(message: string, meta?: any): void {
    this.logger.http(message, meta);
  }

  // Security event logging
  security(message: string, meta?: any): void {
    this.logger.warn(message, { ...meta, type: 'security' });
  }

  // Business event logging
  business(message: string, meta?: any): void {
    this.logger.info(message, { ...meta, type: 'business' });
  }

  // Performance logging
  performance(message: string, meta?: any): void {
    this.logger.info(message, { ...meta, type: 'performance' });
  }

  // Database query logging
  query(message: string, meta?: any): void {
    this.logger.debug(message, { ...meta, type: 'database' });
  }

  // Create child logger with context
  child(context: any): LoggerService {
    const childLogger = new LoggerService();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  // Profile performance
  startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.performance(`${label} completed`, { duration, label });
    };
  }

  // Log with correlation ID
  withCorrelationId(correlationId: string): ILogger {
    return this.child({ correlationId });
  }

  // Log with user context
  withUser(userId: string, email?: string): ILogger {
    return this.child({ userId, email });
  }

  // Log with request context
  withRequest(req: any): ILogger {
    return this.child({
      requestId: req.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  // Audit logging
  audit(action: string, resource: string, userId?: string, meta?: any): void {
    this.info('Audit event', {
      type: 'audit',
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Structured logging for different event types
  events = {
    userLogin: (userId: string, email: string, ip: string) => {
      this.business('User login', {
        event: 'user_login',
        userId,
        email,
        ip,
        timestamp: new Date().toISOString()
      });
    },

    userLogout: (userId: string, email: string) => {
      this.business('User logout', {
        event: 'user_logout',
        userId,
        email,
        timestamp: new Date().toISOString()
      });
    },

    passwordResetRequested: (userId: string, email: string) => {
      this.security('Password reset requested', {
        event: 'password_reset_requested',
        userId,
        email,
        timestamp: new Date().toISOString()
      });
    },

    invoiceProcessed: (invoiceId: string, marketId: string, chaveNFe: string) => {
      this.business('Invoice processed', {
        event: 'invoice_processed',
        invoiceId,
        marketId,
        chaveNFe,
        timestamp: new Date().toISOString()
      });
    },

    alertGenerated: (alertId: string, type: string, marketId: string, priority: string) => {
      this.business('Alert generated', {
        event: 'alert_generated',
        alertId,
        type,
        marketId,
        priority,
        timestamp: new Date().toISOString()
      });
    },

    analyticsJobCompleted: (jobName: string, duration: number, recordsProcessed: number) => {
      this.performance('Analytics job completed', {
        event: 'analytics_job_completed',
        jobName,
        duration,
        recordsProcessed,
        timestamp: new Date().toISOString()
      });
    },

    apiError: (error: Error, endpoint: string, userId?: string) => {
      this.error('API error', {
        event: 'api_error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        endpoint,
        userId,
        timestamp: new Date().toISOString()
      });
    },

    securityIncident: (type: string, ip: string, userAgent: string, details?: any) => {
      this.security('Security incident', {
        event: 'security_incident',
        type,
        ip,
        userAgent,
        details,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Get logger statistics
  getStats(): any {
    return {
      level: this.logger.level,
      transports: this.logger.transports.map(t => ({
        type: t.constructor.name,
        level: (t as any).level
      }))
    };
  }

  // Flush logs (useful for graceful shutdown)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for all transports to finish
      const transports = this.logger.transports;
      let pending = transports.length;

      if (pending === 0) {
        resolve();
        return;
      }

      transports.forEach(transport => {
        if (typeof (transport as any).flush === 'function') {
          (transport as any).flush(() => {
            pending--;
            if (pending === 0) {
              resolve();
            }
          });
        } else {
          pending--;
          if (pending === 0) {
            resolve();
          }
        }
      });
    });
  }

  // Set log level dynamically
  setLevel(level: string): void {
    this.logger.level = level;
    this.logger.transports.forEach(transport => {
      (transport as any).level = level;
    });
  }

  // Database query logging (alias for compatibility)
  database(message: string, meta?: any): void {
    this.query(message, meta);
  }
}

// Export singleton instance
export const logger = new LoggerService();
