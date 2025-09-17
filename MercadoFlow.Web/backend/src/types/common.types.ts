// Common utility types used across the application

export type UUID = string;

export type Timestamp = Date | string;

// Generic repository interface
export interface Repository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findMany(filters?: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: K, data: Partial<T>): Promise<T>;
  delete(id: K): Promise<boolean>;
}

// Soft delete interface
export interface SoftDeletable {
  deletedAt?: Date | null;
  isDeleted?: boolean;
}

// Timestampable interface
export interface Timestampable {
  createdAt: Date;
  updatedAt: Date;
}

// Auditable interface
export interface Auditable extends Timestampable {
  createdBy?: string;
  updatedBy?: string;
}

// Pagination interface
export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Sort options
export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

// Filter operations
export type FilterOperator =
  | 'eq'      // equals
  | 'ne'      // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'in'      // in array
  | 'nin'     // not in array
  | 'like'    // contains (case insensitive)
  | 'ilike'   // contains (case insensitive)
  | 'regex'   // regular expression
  | 'exists'  // field exists
  | 'null'    // field is null
  | 'nnull';  // field is not null

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: any;
}

// Query options
export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: SortOption[];
  filters?: Filter[];
  select?: string[];
  include?: string[];
}

// Service response wrapper
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
}

// Cache interface
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flush(): Promise<void>;
}

// Email interface
export interface EmailService {
  sendEmail(to: string | string[], subject: string, template: string, data?: any): Promise<boolean>;
  sendWelcomeEmail(to: string, name: string): Promise<boolean>;
  sendResetPasswordEmail(to: string, token: string): Promise<boolean>;
  sendAlertEmail(to: string, alert: any): Promise<boolean>;
}

// File storage interface
export interface FileStorageService {
  upload(file: Buffer, filename: string, contentType: string): Promise<string>;
  download(url: string): Promise<Buffer>;
  delete(url: string): Promise<boolean>;
  getSignedUrl(url: string, expiresIn?: number): Promise<string>;
}

// Notification interface
export interface NotificationService {
  sendNotification(userId: string, message: string, type: string, data?: any): Promise<boolean>;
  sendBulkNotification(userIds: string[], message: string, type: string, data?: any): Promise<boolean>;
  markAsRead(notificationId: string): Promise<boolean>;
  getUnreadCount(userId: string): Promise<number>;
}

// Analytics event tracking
export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  marketId?: string;
  timestamp: Date;
  properties: Record<string, any>;
  sessionId?: string;
}

// Configuration interface
export interface ConfigService {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  getAll(): Record<string, any>;
  reload(): Promise<void>;
}

// Logger interface
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  fatal(message: string, meta?: any): void;
}

// Health check interfaces
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy';
  message?: string;
  metadata?: Record<string, any>;
  duration?: number;
}

export interface HealthCheckService {
  check(): Promise<HealthCheck>;
}

// Background job interfaces
export interface Job {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface JobQueue {
  add(type: string, data: any, options?: JobOptions): Promise<Job>;
  process(type: string, handler: JobHandler): void;
  getJob(id: string): Promise<Job | null>;
  getWaiting(): Promise<Job[]>;
  getActive(): Promise<Job[]>;
  getCompleted(): Promise<Job[]>;
  getFailed(): Promise<Job[]>;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: 'fixed' | 'exponential';
  removeOnComplete?: number;
  removeOnFail?: number;
}

export type JobHandler = (job: Job) => Promise<any>;

// Webhook interfaces
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface WebhookEvent {
  type: string;
  data: any;
  timestamp: Date;
  webhookId: string;
}

// Rate limiting
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipIf?: (req: any) => boolean;
}

// API Key management
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsed?: Date;
  createdAt: Date;
}

// Metrics and monitoring
export interface Metric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface MetricsCollector {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  decrement(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, duration: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}

// Environment types
export type Environment = 'development' | 'test' | 'staging' | 'production';

// Generic error types
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}