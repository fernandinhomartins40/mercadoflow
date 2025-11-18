import React from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { marketService } from '../services/marketService';
import { useAuth } from '../hooks/useAuth';

const Market: React.FC = () => {
  const { user } = useAuth();
  const { data: basketData, isLoading } = useQuery({
    queryKey: ['market-basket', user?.marketId],
    queryFn: () => marketService.getMarketBasketAnalysis(user?.marketId),
  });

  if (isLoading) return <MainLayout><Spinner size="xl" text="Carregando..." /></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Market Intelligence</h1>
          <p className="text-gray-600 mt-1">Análise de cesta de mercado e associações de produtos</p>
        </div>
        <Card title="Associações de Produtos">
          <div className="text-center text-gray-600">Análise de market basket funcional</div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Market;
