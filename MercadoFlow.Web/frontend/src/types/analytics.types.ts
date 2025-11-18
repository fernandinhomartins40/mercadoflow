export interface DashboardSummary {
  totalSales: number;
  totalRevenue: number;
  transactionCount: number;
  averageTicket: number;
  uniqueCustomers: number;
  uniqueProducts: number;
  period: {
    start: string;
    end: string;
  };
}

export interface ProductMetrics {
  productId: string;
  ean: string;
  name: string;
  category: string;
  brand?: string;
  totalQuantity: number;
  totalRevenue: number;
  transactionCount: number;
  averagePrice: number;
  growth?: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  quantity: number;
  transactions: number;
  averageTicket: number;
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  quantity: number;
  productCount: number;
  transactionCount: number;
  growth?: number;
  marketShare: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  topProducts: ProductMetrics[];
  salesTrend: SalesTrend[];
  categoryPerformance: CategoryPerformance[];
  alerts: Alert[];
  insights: Insight[];
  previousPeriodComparison: {
    salesGrowth: number;
    revenueGrowth: number;
    transactionGrowth: number;
    ticketGrowth: number;
  };
}

export interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'LOW_STOCK' | 'SLOW_MOVING' | 'HIGH_PERFORMING' | 'ANOMALY' | 'SYSTEM';
  title: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  isRead: boolean;
  marketId: string;
  productId?: string;
  createdAt: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
}
