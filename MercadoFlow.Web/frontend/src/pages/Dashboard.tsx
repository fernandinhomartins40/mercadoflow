import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', user?.marketId, dateRange.startDate, dateRange.endDate],
    queryFn: () => dashboardService.getDashboardData(user?.marketId, dateRange.startDate, dateRange.endDate),
  });

  if (isLoading) return <MainLayout><Spinner size="xl" text="Carregando..." /></MainLayout>;

  const summary = dashboardData?.summary;
  const comparison = dashboardData?.previousPeriodComparison;

  const stats = [
    { name: 'Receita Total', value: formatCurrency(summary?.totalRevenue || 0), change: comparison?.revenueGrowth || 0, icon: '💰' },
    { name: 'Transações', value: formatNumber(summary?.transactionCount || 0), change: comparison?.transactionGrowth || 0, icon: '🛒' },
    { name: 'Ticket Médio', value: formatCurrency(summary?.averageTicket || 0), change: comparison?.ticketGrowth || 0, icon: '📊' },
    { name: 'Produtos Únicos', value: formatNumber(summary?.uniqueProducts || 0), change: 0, icon: '📦' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Visão geral do desempenho</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.name}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </Card>
          ))}
        </div>

        <Card title="Top 10 Produtos">
          <div className="text-center text-gray-600">Dashboard funcional - Conectado à API</div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
