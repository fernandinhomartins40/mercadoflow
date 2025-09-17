// Alert types (converted from Prisma enums to string literals)
export type AlertType = 'LOW_STOCK' | 'HIGH_PERFORMING' | 'SLOW_MOVING' | 'EXPIRATION_RISK' | 'PROMOTION_OPPORTUNITY';
export type AlertPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Dashboard analytics types
export interface DashboardMetrics {
  summary: SalesSummary;
  topProducts: TopProduct[];
  recentAlerts: AlertSummary[];
  salesTrend: SalesTrendData[];
  marketBasket: MarketBasketRule[];
}

export interface SalesSummary {
  totalRevenue: number;
  totalInvoices: number;
  totalItems: number;
  averageTicket: number;

  // Comparisons with previous period
  revenueGrowth: number;
  invoiceGrowth: number;
  ticketGrowth: number;

  // Period information
  periodStart: Date;
  periodEnd: Date;
  previousPeriodStart: Date;
  previousPeriodEnd: Date;
}

export interface TopProduct {
  id: string;
  ean: string;
  name: string;
  category: string;
  brand?: string;
  totalRevenue: number;
  totalQuantity: number;
  transactionCount: number;
  averagePrice: number;
  growthRate: number;
  rank: number;
}

export interface SalesTrendData {
  date: string;
  revenue: number;
  invoiceCount: number;
  itemCount: number;
  averageTicket: number;
}

// Market Basket Analysis
export interface MarketBasketRule {
  id: string;
  antecedent: ProductBasket[];
  consequent: ProductBasket[];
  support: number;
  confidence: number;
  lift: number;
  analyzedAt: Date;
  marketId: string;
}

export interface ProductBasket {
  id: string;
  ean: string;
  name: string;
  category: string;
}

export interface MarketBasketAnalysisRequest {
  marketId: string;
  dateFrom: Date;
  dateTo: Date;
  minSupport?: number;
  minConfidence?: number;
  maxRules?: number;
}

// Demand Forecasting
export interface DemandForecast {
  productId: string;
  marketId: string;
  forecastDate: Date;
  predictedDemand: number;
  confidence: number;
  factors: ForecastFactor[];
  historicalData: HistoricalSalesPoint[];
}

export interface ForecastFactor {
  name: string;
  impact: number; // -1 to 1
  description: string;
}

export interface HistoricalSalesPoint {
  date: Date;
  quantity: number;
  revenue: number;
  price: number;
}

// Price Elasticity Analysis
export interface PriceElasticity {
  productId: string;
  marketId: string;
  elasticity: number;
  category: 'elastic' | 'inelastic' | 'perfectly_elastic' | 'perfectly_inelastic';
  optimalPrice?: number;
  revenueImpact?: number;
  dataPoints: PriceDataPoint[];
  analyzedAt: Date;
}

export interface PriceDataPoint {
  date: Date;
  price: number;
  quantity: number;
  revenue: number;
}

// Product Performance
export interface ProductPerformanceMetrics {
  productId: string;
  marketId: string;
  period: DatePeriod;

  sales: {
    totalRevenue: number;
    totalQuantity: number;
    transactionCount: number;
    averagePrice: number;
  };

  performance: {
    turnoverRate?: number;
    marginPercent?: number;
    growthRate: number;
    purchaseFrequency: number;
    score: number; // 0-100
  };

  comparison: {
    categoryAverage: number;
    marketAverage: number;
    rank: number;
    percentile: number;
  };

  trends: TrendIndicator[];
}

export interface TrendIndicator {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number; // percentage change
  significance: 'high' | 'medium' | 'low';
}

// Seasonal Analysis
export interface SeasonalAnalysis {
  productId: string;
  marketId: string;
  seasonality: SeasonalPattern[];
  peakPeriods: PeakPeriod[];
  recommendations: SeasonalRecommendation[];
}

export interface SeasonalPattern {
  period: 'monthly' | 'weekly' | 'daily';
  values: SeasonalValue[];
  strength: number; // 0-1
}

export interface SeasonalValue {
  index: number; // month (1-12), day of week (1-7), hour (0-23)
  label: string;
  factor: number; // multiplier vs average
  confidence: number;
}

export interface PeakPeriod {
  start: Date;
  end: Date;
  averageIncrease: number;
  description: string;
}

export interface SeasonalRecommendation {
  type: 'stock_increase' | 'stock_decrease' | 'promotion' | 'marketing';
  period: DatePeriod;
  description: string;
  expectedImpact: number;
  priority: 'high' | 'medium' | 'low';
}

// Alert System
export interface AlertSummary {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  priority: AlertPriority;
  isRead: boolean;
  createdAt: Date;
  productInfo?: {
    id: string;
    name: string;
    ean: string;
    category: string;
  };
}

export interface AlertRule {
  id: string;
  type: AlertType;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  marketId?: string; // null for global rules
}

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte' | 'in' | 'not_in';
  value: any;
  timeframe?: number; // in days
}

export interface AlertAction {
  type: 'email' | 'notification' | 'webhook';
  config: any;
}

// Common utility types
export interface DatePeriod {
  start: Date;
  end: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

// Advanced Analytics
export interface CustomerSegmentation {
  marketId: string;
  segments: CustomerSegment[];
  analyzedAt: Date;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  customerCount: number;
  averageSpend: number;
  characteristics: SegmentCharacteristic[];
  recommendations: string[];
}

export interface SegmentCharacteristic {
  attribute: string;
  value: string | number;
  importance: number; // 0-1
}

// Product Clustering
export interface ProductCluster {
  id: string;
  name: string;
  products: ClusteredProduct[];
  characteristics: ClusterCharacteristic[];
  recommendedStrategies: string[];
  marketId: string;
}

export interface ClusteredProduct {
  productId: string;
  ean: string;
  name: string;
  similarity: number; // 0-1
}

export interface ClusterCharacteristic {
  feature: string;
  averageValue: number;
  variance: number;
}