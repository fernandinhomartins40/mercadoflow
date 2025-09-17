import { createClient, RedisClientType } from 'redis';
import { CacheService } from '../types/common.types';
import { ConfigService } from './ConfigService';
import { LoggerService } from './LoggerService';

export class RedisService implements CacheService {
  private client: RedisClientType;
  private config: ConfigService;
  private logger: LoggerService;
  private isConnected: boolean = false;

  constructor() {
    this.config = new ConfigService();
    this.logger = new LoggerService();
    this.client = this.createClient();
    this.setupEventHandlers();
  }

  private createClient(): RedisClientType {
    const redisUrl = this.config.getRedisUrl();

    return createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis: Max reconnection attempts reached');
            return false;
          }

          const delay = Math.min(retries * 100, 3000);
          this.logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        }
      },
      database: this.config.get('REDIS_DB', 0)
    });
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.info('Redis: Connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.logger.info('Redis: Connected and ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis: Connection error', { error: error.message });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      this.logger.warn('Redis: Connection ended');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis: Reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        this.logger.info('Redis: Connection established');
      }
    } catch (error) {
      this.logger.error('Redis: Failed to connect', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        this.logger.info('Redis: Disconnected');
      }
    } catch (error) {
      this.logger.error('Redis: Failed to disconnect', { error });
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        // If not JSON, return as string
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error('Redis: Failed to get key', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(key, ttl, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (error) {
      this.logger.error('Redis: Failed to set key', { key, error });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error('Redis: Failed to delete key', { key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis: Failed to check key existence', { key, error });
      return false;
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushDb();
      this.logger.info('Redis: Database flushed');
    } catch (error) {
      this.logger.error('Redis: Failed to flush database', { error });
      throw error;
    }
  }

  // Advanced cache operations

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      });
    } catch (error) {
      this.logger.error('Redis: Failed to get multiple keys', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset(keyValues: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.multi();

      Object.entries(keyValues).forEach(([key, value]) => {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl) {
          pipeline.setEx(key, ttl, stringValue);
        } else {
          pipeline.set(key, stringValue);
        }
      });

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Redis: Failed to set multiple keys', { keys: Object.keys(keyValues), error });
      throw error;
    }
  }

  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const result = await this.client.incr(key);
      if (ttl && result === 1) {
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      this.logger.error('Redis: Failed to increment key', { key, error });
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error('Redis: Failed to decrement key', { key, error });
      throw error;
    }
  }

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.client.hGet(key, field);
      if (value === null) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error('Redis: Failed to get hash field', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.hSet(key, field, stringValue);
    } catch (error) {
      this.logger.error('Redis: Failed to set hash field', { key, field, error });
      throw error;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const hash = await this.client.hGetAll(key);
      const result: Record<string, T> = {};

      Object.entries(hash).forEach(([field, value]) => {
        try {
          result[field] = JSON.parse(value) as T;
        } catch {
          result[field] = value as unknown as T;
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Redis: Failed to get hash', { key, error });
      return {};
    }
  }

  // List operations
  async lpush(key: string, value: any): Promise<number> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.lPush(key, stringValue);
    } catch (error) {
      this.logger.error('Redis: Failed to push to list', { key, error });
      throw error;
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.rPop(key);
      if (value === null) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error('Redis: Failed to pop from list', { key, error });
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.lLen(key);
    } catch (error) {
      this.logger.error('Redis: Failed to get list length', { key, error });
      return 0;
    }
  }

  // Set operations
  async sadd(key: string, member: any): Promise<number> {
    try {
      const stringValue = typeof member === 'string' ? member : JSON.stringify(member);
      return await this.client.sAdd(key, stringValue);
    } catch (error) {
      this.logger.error('Redis: Failed to add to set', { key, error });
      throw error;
    }
  }

  async sismember(key: string, member: any): Promise<boolean> {
    try {
      const stringValue = typeof member === 'string' ? member : JSON.stringify(member);
      return await this.client.sIsMember(key, stringValue);
    } catch (error) {
      this.logger.error('Redis: Failed to check set membership', { key, error });
      return false;
    }
  }

  // Expire operations
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return (await this.client.expire(key, seconds)) === 1;
    } catch (error) {
      this.logger.error('Redis: Failed to set expiry', { key, seconds, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error('Redis: Failed to get TTL', { key, error });
      return -1;
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error('Redis: Failed to get keys by pattern', { pattern, error });
      return [];
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      return await this.client.del(keys);
    } catch (error) {
      this.logger.error('Redis: Failed to delete keys by pattern', { pattern, error });
      return 0;
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis: Ping failed', { error });
      return false;
    }
  }

  // Session management helpers
  async setSession(sessionId: string, data: any, ttl: number = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttl);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return await this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Rate limiting helpers
  async checkRateLimit(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const current = await this.incr(key, window);
      const ttl = await this.ttl(key);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime: Date.now() + (ttl * 1000)
      };
    } catch (error) {
      this.logger.error('Redis: Rate limit check failed', { key, error });
      return { allowed: true, remaining: limit, resetTime: Date.now() + window * 1000 };
    }
  }

  // Statistics
  async getStats(): Promise<any> {
    try {
      const info = await this.client.info();
      return {
        connected: this.isConnected,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      this.logger.error('Redis: Failed to get stats', { error });
      return { connected: this.isConnected, info: null };
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const sections = info.split('\r\n\r\n');

    sections.forEach(section => {
      const lines = section.split('\r\n');
      if (lines[0].startsWith('#')) {
        const sectionName = lines[0].substring(1).trim();
        result[sectionName] = {};

        lines.slice(1).forEach(line => {
          if (line && line.includes(':')) {
            const [key, value] = line.split(':');
            result[sectionName][key] = value;
          }
        });
      }
    });

    return result;
  }
}