import api from './api';
import {
  SystemHealth,
  UserManagement,
  MarketManagement,
  User,
  Market,
  UpdateUserRequest,
  CreateUserRequest,
} from '../types';

export const adminService = {
  // System Overview
  async getSystemHealth(action?: string, userId?: string, period?: string): Promise<SystemHealth> {
    const params = new URLSearchParams();
    if (action) params.append('action', action);
    if (userId) params.append('userId', userId);
    if (period) params.append('period', period);

    const response = await api.get<SystemHealth>(`/api/v1/admin?${params.toString()}`);
    return response.data;
  },

  async getSystemInfo(): Promise<any> {
    const response = await api.get('/api/v1/admin/system');
    return response.data;
  },

  // User Management
  async getUsers(page?: number, limit?: number): Promise<UserManagement> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());

    const response = await api.get<UserManagement>(`/api/v1/admin/users?${params.toString()}`);
    return response.data;
  },

  async toggleUserStatus(userId: string): Promise<User> {
    const response = await api.post<User>(`/api/v1/admin/users/${userId}/toggle-status`);
    return response.data;
  },

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/admin/users', data);
    return response.data;
  },

  async updateUser(userId: string, data: UpdateUserRequest): Promise<User> {
    const response = await api.put<User>(`/api/v1/admin/users/${userId}`, data);
    return response.data;
  },

  // Market Management
  async getMarkets(): Promise<MarketManagement> {
    const response = await api.get<MarketManagement>('/api/v1/admin/markets');
    return response.data;
  },
};

export default adminService;
