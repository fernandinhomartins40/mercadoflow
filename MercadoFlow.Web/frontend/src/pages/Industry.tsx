import React from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { industryService } from '../services/industryService';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

const Industry: React.FC = () => {
  const { user } = useAuth();
  const { data: benchmarks, isLoading } = useQuery({
    queryKey: ['industry-benchmarks', user?.marketId],
    queryFn: () => industryService.getBenchmarks(user?.marketId),
  });

  if (isLoading) return <MainLayout><Spinner size="xl" text="Carregando..." /></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Benchmarks do Setor</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Seu Mercado">
            <p className="text-2xl font-bold">{formatCurrency(benchmarks?.userMarket?.revenue || 0)}</p>
          </Card>
          <Card title="Média do Setor">
            <p className="text-2xl font-bold">{formatCurrency(benchmarks?.industryAverage?.revenue || 0)}</p>
          </Card>
          <Card title="Melhor Desempenho">
            <p className="text-2xl font-bold">{formatCurrency(benchmarks?.topPerformer?.revenue || 0)}</p>
          </Card>
        </div>
        <Card title="Ranking">
          <p className="text-4xl font-bold text-indigo-600">{benchmarks?.percentileRanking || 0}º percentil</p>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Industry;
