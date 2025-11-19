import { User, UserRole } from './auth.types';
import { Market } from './market.types';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    api: ServiceHealth;
  };
  metrics: SystemMetrics;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  lastCheck: string;
  message?: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
  averageResponseTime: number;
}

export interface UserManagement {
  users: User[];
  total: number;
  byRole: Record<UserRole, number>;
}

export interface MarketManagement {
  markets: Market[];
  total: number;
  active: number;
  inactive: number;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  marketId?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  marketId?: string;
  isActive?: boolean;
}

export interface CreateMarketRequest {
  name: string;
  cnpj: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
}

export interface UpdateMarketRequest {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  maxUploadSize: number;
  sessionTimeout: number;
  enableNotifications: boolean;
  enableBackups: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
