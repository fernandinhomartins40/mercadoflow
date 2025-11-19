export interface Market {
  id: string;
  name: string;
  cnpj: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketOverview {
  totalMarkets: number;
  activeMarkets: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface MarketStatistics {
  marketId: string;
  marketName: string;
  revenue: number;
  transactionCount: number;
  averageTicket: number;
  uniqueProducts: number;
  topCategory: string;
  growth: number;
}

export interface MarketBasketItem {
  product1: ProductInfo;
  product2: ProductInfo;
  support: number;
  confidence: number;
  lift: number;
  occurrences: number;
}

export interface ProductInfo {
  id: string;
  ean: string;
  name: string;
  category: string;
  brand?: string;
}

export interface MarketDetails {
  market: Market;
  statistics: MarketStatistics;
  recentAssociations: MarketBasketItem[];
  topProducts: ProductMetrics[];
}
