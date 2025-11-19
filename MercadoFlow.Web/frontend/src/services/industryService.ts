import api from './api';
import {
  IndustryOverview,
  IndustryBenchmark,
  MarketComparison,
  IndustryTrend,
} from '../types';

export const industryService = {
  async getIndustryOverview(sector?: string, size?: string, period?: string): Promise<IndustryOverview> {
    const params = new URLSearchParams();
    if (sector) params.append('sector', sector);
    if (size) params.append('size', size);
    if (period) params.append('period', period);

    const response = await api.get<IndustryOverview>(`/api/v1/industries?${params.toString()}`);
    return response.data;
  },

  async getBenchmarks(marketId?: string): Promise<MarketComparison> {
    const response = await api.get<MarketComparison>('/api/v1/industries/benchmarks');
    return response.data;
  },

  async getIndustryDetails(industryId: string): Promise<any> {
    const response = await api.get(`/api/v1/industries/${industryId}`);
    return response.data;
  },
};

export default industryService;
