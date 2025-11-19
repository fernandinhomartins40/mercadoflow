export interface IndustryBenchmark {
  metric: string;
  value: number;
  industryAverage: number;
  percentile: number;
  trend: 'above' | 'below' | 'average';
}

export interface IndustryOverview {
  totalMarkets: number;
  totalRevenue: number;
  averageRevenue: number;
  totalTransactions: number;
  averageTransactions: number;
  averageTicket: number;
  topCategories: CategoryBenchmark[];
}

export interface CategoryBenchmark {
  category: string;
  marketShare: number;
  averagePrice: number;
  averageQuantity: number;
  totalRevenue: number;
}

export interface MarketComparison {
  userMarket: MarketPerformanceMetrics;
  industryAverage: MarketPerformanceMetrics;
  topPerformer: MarketPerformanceMetrics;
  percentileRanking: number;
  strengths: string[];
  opportunities: string[];
}

export interface MarketPerformanceMetrics {
  revenue: number;
  transactionCount: number;
  averageTicket: number;
  productDiversity: number;
  customerRetention?: number;
  growth: number;
}

export interface IndustryTrend {
  period: string;
  revenue: number;
  transactions: number;
  averageTicket: number;
  marketCount: number;
}

export interface BenchmarkRecommendation {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  actionItems: string[];
}
