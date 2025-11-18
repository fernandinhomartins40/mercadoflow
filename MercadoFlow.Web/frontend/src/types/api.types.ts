export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    api: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down';
  responseTime?: number;
  message?: string;
}
