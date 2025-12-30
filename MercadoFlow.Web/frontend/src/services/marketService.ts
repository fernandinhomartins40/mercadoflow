import api from './api';
import {
  MarketOverview,
  MarketStatistics,
  MarketBasketItem,
  MarketDetails,
  MarketListResponse,
  Pdv
} from '../types';

export const marketService = {
  unwrapResponse<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload) {
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Falha na requisicao');
      }
      return payload.data as T;
    }
    return payload as T;
  },

  async getMarkets(): Promise<MarketListResponse> {
    const response = await api.get<MarketListResponse>('/api/v1/markets');
    return this.unwrapResponse<MarketListResponse>(response.data);
  },

  async createMarket(data: {
    name: string;
    cnpj?: string;
    address: string;
    city: string;
    state: string;
    region: string;
  }) {
    const response = await api.post('/api/v1/markets', data);
    return this.unwrapResponse(response.data);
  },

  async createPdv(marketId: string, data: { name: string; identifier: string }): Promise<Pdv> {
    const response = await api.post<Pdv>(`/api/v1/markets/${marketId}/pdvs`, data);
    return this.unwrapResponse<Pdv>(response.data);
  },

  async getMarketOverview(): Promise<MarketOverview> {
    const response = await api.get<MarketOverview>('/api/v1/markets');
    return this.unwrapResponse<MarketOverview>(response.data);
  },

  async getMarketBasketAnalysis(marketId?: string, minSupport?: number, minConfidence?: number): Promise<MarketBasketItem[]> {
    const params = new URLSearchParams();
    if (marketId) params.append('marketId', marketId);
    if (minSupport) params.append('minSupport', minSupport.toString());
    if (minConfidence) params.append('minConfidence', minConfidence.toString());

    const response = await api.get<MarketBasketItem[]>(`/api/v1/markets/analysis?${params.toString()}`);
    return this.unwrapResponse<MarketBasketItem[]>(response.data);
  },

  async getMarketDetails(marketId: string): Promise<MarketDetails> {
    const response = await api.get<MarketDetails>(`/api/v1/markets/${marketId}`);
    return this.unwrapResponse<MarketDetails>(response.data);
  },
};

export default marketService;
