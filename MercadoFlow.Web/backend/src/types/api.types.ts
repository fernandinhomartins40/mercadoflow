// Standard API Response format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter parameters for different endpoints
export interface ProductFilters extends PaginationParams {
  category?: string;
  brand?: string;
  ean?: string;
  name?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceFilters extends PaginationParams {
  marketId?: string;
  pdvId?: string;
  dateFrom?: string;
  dateTo?: string;
  cnpjEmitente?: string;
  documentType?: 'NFE' | 'NFCE';
}

export interface AlertFilters extends PaginationParams {
  type?: string;
  priority?: string;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    api: 'up' | 'down';
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

// Error codes
export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR'
}

// Request validation schemas types
export interface ValidationErrorField {
  field: string;
  message: string;
  code: string;
}

// File upload types
export interface FileUploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

// Batch operation types
export interface BatchRequest<T> {
  items: T[];
  options?: {
    skipValidation?: boolean;
    continueOnError?: boolean;
  };
}

export interface BatchResponse<T> {
  success: T[];
  errors: Array<{
    index: number;
    item: T;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}