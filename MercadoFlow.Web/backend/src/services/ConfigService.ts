import { config } from 'dotenv';
import { ConfigService as IConfigService, Environment } from '../types/common.types';

// Load environment variables
config();

export class ConfigService implements IConfigService {
  private configs: Map<string, any> = new Map();

  constructor() {
    this.loadDefaultConfigs();
  }

  private loadDefaultConfigs(): void {
    // Default configurations
    const defaults = {
      NODE_ENV: 'development',
      PORT: 3000,
      HOST: '0.0.0.0',

      // Database
      DATABASE_URL: 'file:./data/mercadoflow.db',

      // JWT & Security
      JWT_SECRET: 'your_super_secure_jwt_secret_key_change_this_in_production',
      JWT_EXPIRES_IN: '7d',
      BCRYPT_ROUNDS: 12,

      // Redis
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
      REDIS_URL: 'redis://localhost:6379',

      // CORS
      CORS_ORIGIN: 'http://localhost:3001',

      // Rate Limiting
      RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
      RATE_LIMIT_MAX_REQUESTS: 100,

      // File Upload
      MAX_FILE_SIZE: '50MB',
      UPLOAD_PATH: './uploads',

      // Email
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_USER: '',
      SMTP_PASS: '',
      EMAIL_FROM: 'MercadoFlow <noreply@mercadoflow.com>',

      // Analytics
      ANALYTICS_BATCH_SIZE: 1000,
      MARKET_BASKET_MIN_SUPPORT: 0.01,
      MARKET_BASKET_MIN_CONFIDENCE: 0.5,

      // Logging
      LOG_LEVEL: 'info',
      LOG_FORMAT: 'json',

      // Health Check
      HEALTH_CHECK_TIMEOUT: 30000,

      // Application
      APP_NAME: 'MercadoFlow Intelligence',
      APP_VERSION: '1.0.0',
      APP_URL: 'https://api.mercadoflow.com'
    };

    // Load defaults and override with environment variables
    Object.entries(defaults).forEach(([key, defaultValue]) => {
      const envValue = process.env[key];
      let value = envValue !== undefined ? envValue : defaultValue;

      // Type conversion
      if (typeof defaultValue === 'number') {
        value = envValue ? parseInt(envValue, 10) : defaultValue;
      } else if (typeof defaultValue === 'boolean') {
        value = envValue ? (envValue.toLowerCase() === 'true') : defaultValue;
      } else {
        value = envValue !== undefined ? envValue : defaultValue;
      }

      this.configs.set(key, value);
    });
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.configs.get(key);
    if (value !== undefined) {
      return value as T;
    }

    const envValue = process.env[key];
    if (envValue !== undefined) {
      // Try to parse JSON if it looks like JSON
      if (envValue.startsWith('{') || envValue.startsWith('[')) {
        try {
          return JSON.parse(envValue) as T;
        } catch {
          // If JSON parsing fails, return as string
        }
      }

      // Type conversion based on default value
      if (defaultValue !== undefined) {
        if (typeof defaultValue === 'number') {
          return parseInt(envValue, 10) as unknown as T;
        } else if (typeof defaultValue === 'boolean') {
          return (envValue.toLowerCase() === 'true') as unknown as T;
        }
      }

      return envValue as unknown as T;
    }

    return defaultValue as T;
  }

  set(key: string, value: any): void {
    this.configs.set(key, value);
  }

  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    this.configs.forEach((value, key) => {
      result[key] = value;
    });

    // Add environment variables not in configs
    Object.keys(process.env).forEach(key => {
      if (!result[key]) {
        result[key] = process.env[key];
      }
    });

    return result;
  }

  async reload(): Promise<void> {
    // Clear current configs
    this.configs.clear();

    // Reload dotenv
    config({ override: true });

    // Reload default configs
    this.loadDefaultConfigs();
  }

  // Environment helpers
  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }

  getEnvironment(): Environment {
    return this.get('NODE_ENV', 'development') as Environment;
  }

  // Database helpers
  getDatabaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  // Redis helpers
  getRedisUrl(): string {
    const url = this.get('REDIS_URL');
    if (url) {
      return url;
    }

    const host = this.get('REDIS_HOST');
    const port = this.get('REDIS_PORT');
    const password = this.get('REDIS_PASSWORD');

    if (password) {
      return `redis://:${password}@${host}:${port}`;
    }

    return `redis://${host}:${port}`;
  }

  // JWT helpers
  getJwtSecret(): string {
    const secret = this.get('JWT_SECRET');
    if (!secret || secret === 'your_super_secure_jwt_secret_key_change_this_in_production') {
      if (this.isProduction()) {
        throw new Error('JWT_SECRET must be set in production environment');
      }
    }
    return secret;
  }

  getJwtExpiresIn(): string {
    return this.get('JWT_EXPIRES_IN', '7d');
  }

  // CORS helpers
  getCorsOrigins(): string[] {
    const origins = this.get('CORS_ORIGIN', '');
    return origins.split(',').map((origin: string) => origin.trim()).filter(Boolean);
  }

  // File upload helpers
  getMaxFileSize(): number {
    const size = this.get('MAX_FILE_SIZE', '50MB');
    if (typeof size === 'string') {
      const match = size.match(/^(\d+)(MB|KB|GB)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = ((match[2] || 'MB') as string).toUpperCase();

        switch (unit) {
          case 'KB':
            return value * 1024;
          case 'MB':
            return value * 1024 * 1024;
          case 'GB':
            return value * 1024 * 1024 * 1024;
          default:
            return value;
        }
      }
    }
    return typeof size === 'number' ? size : 52428800; // 50MB default
  }

  // Analytics helpers
  getAnalyticsBatchSize(): number {
    return this.get('ANALYTICS_BATCH_SIZE', 1000);
  }

  getMarketBasketMinSupport(): number {
    return this.get('MARKET_BASKET_MIN_SUPPORT', 0.01);
  }

  getMarketBasketMinConfidence(): number {
    return this.get('MARKET_BASKET_MIN_CONFIDENCE', 0.5);
  }

  // Email helpers
  getEmailConfig() {
    return {
      host: this.get('SMTP_HOST'),
      port: this.get('SMTP_PORT', 587),
      secure: (this.get('SMTP_PORT', 587) as number) === 465,
      auth: {
        user: this.get('SMTP_USER'),
        pass: this.get('SMTP_PASS')
      }
    };
  }

  getEmailFrom(): string {
    return this.get('EMAIL_FROM', 'MercadoFlow <noreply@mercadoflow.com>');
  }

  // Validation
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required in production
    if (this.isProduction()) {
      const requiredProdKeys = [
        'JWT_SECRET',
        'DATABASE_URL'
      ];

      requiredProdKeys.forEach(key => {
        if (!this.get(key)) {
          errors.push(`${key} is required in production environment`);
        }
      });

      // Validate JWT secret strength in production
      const jwtSecret = this.get('JWT_SECRET');
      if (jwtSecret && jwtSecret.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long in production');
      }
    }

    // Validate numeric values
    const numericKeys = ['PORT', 'REDIS_PORT', 'SMTP_PORT', 'BCRYPT_ROUNDS'];
    numericKeys.forEach(key => {
      const value = this.get(key);
      if (value !== undefined && isNaN(Number(value))) {
        errors.push(`${key} must be a valid number`);
      }
    });

    // Validate email configuration if email features are used
    if (this.get('SMTP_USER') || this.get('SMTP_PASS')) {
      if (!this.get('SMTP_HOST')) {
        errors.push('SMTP_HOST is required when SMTP credentials are provided');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Debug helper
  getSecureConfig(): Record<string, any> {
    const config = this.getAll();
    const sensitiveKeys = [
      'JWT_SECRET',
      'REDIS_PASSWORD',
      'SMTP_PASS',
      'DATABASE_URL'
    ];

    // Mask sensitive values
    sensitiveKeys.forEach(key => {
      if (config[key]) {
        config[key] = '[REDACTED]';
      }
    });

    return config;
  }
}