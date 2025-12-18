import { ProductMetrics } from './analytics.types';

export interface Product {
  id: string;
  ean: string;
  name: string;
  category: string;
  brand?: string;
  unit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAssociation {
  product1Id: string;
  product2Id: string;
  product1: Product;
  product2: Product;
  support: number;
  confidence: number;
  lift: number;
  marketId: string;
  createdAt: string;
}

export interface ProductRecommendation {
  product: Product;
  score: number;
  reason: string;
  relatedProducts: Product[];
}

export interface ProductPerformance {
  product: Product;
  metrics: ProductMetrics;
  trend: 'up' | 'down' | 'stable';
  forecast?: number[];
  anomalies?: ProductAnomaly[];
}

export interface ProductAnomaly {
  date: string;
  type: 'spike' | 'drop' | 'unusual';
  value: number;
  expectedValue: number;
  zScore: number;
}
