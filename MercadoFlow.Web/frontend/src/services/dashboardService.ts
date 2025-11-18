import api from './api';
import { DashboardData, Alert } from '../types';

export const dashboardService = {
  async getDashboardData(marketId?: string, startDate?: string, endDate?: string): Promise<DashboardData> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<DashboardData>(`/api/v1/dashboard?${params.toString()}`);
    return response.data;
  },

  async getAlerts(marketId?: string, limit?: number): Promise<Alert[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (limit) params.append('limit', limit.toString());

    const response = await api.get<Alert[]>(`/api/v1/dashboard/alerts?${params.toString()}`);
    return response.data;
  },

  async markAlertAsRead(alertId: string): Promise<void> {
    await api.post(`/api/v1/dashboard/alerts/${alertId}/read`);
  },
};

export default dashboardService;
