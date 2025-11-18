import api from './api';
import { ProductMetrics, SalesTrend, CategoryPerformance } from '../types';

export const analyticsService = {
  async getTopProducts(marketId?: string, startDate?: string, endDate?: string, limit?: number): Promise<ProductMetrics[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit.toString());

    const response = await api.get<ProductMetrics[]>(`/api/v1/analytics/top-products?${params.toString()}`);
    return response.data;
  },

  async getSalesTrend(marketId?: string, startDate?: string, endDate?: string, groupBy?: string): Promise<SalesTrend[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (groupBy) params.append('groupBy', groupBy);

    const response = await api.get<SalesTrend[]>(`/api/v1/analytics/sales-trend?${params.toString()}`);
    return response.data;
  },

  async getCategoryPerformance(marketId?: string, startDate?: string, endDate?: string): Promise<CategoryPerformance[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<CategoryPerformance[]>(`/api/v1/analytics/category-performance?${params.toString()}`);
    return response.data;
  },
};

export default analyticsService;
