import api from './api';
import { MarketOverview, MarketStatistics, MarketBasketItem, MarketDetails } from '../types';

export const marketService = {
  async getMarketOverview(): Promise<MarketOverview> {
    const response = await api.get<MarketOverview>('/api/v1/markets');
    return response.data;
  },

  async getMarketBasketAnalysis(marketId?: string, minSupport?: number, minConfidence?: number): Promise<MarketBasketItem[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (minSupport) params.append('minSupport', minSupport.toString());
    if (minConfidence) params.append('minConfidence', minConfidence.toString());

    const response = await api.get<MarketBasketItem[]>(`/api/v1/markets/analysis?${params.toString()}`);
    return response.data;
  },

  async getMarketDetails(marketId: string): Promise<MarketDetails> {
    const response = await api.get<MarketDetails>(`/api/v1/markets/${marketId}`);
    return response.data;
  },
};

export default marketService;
