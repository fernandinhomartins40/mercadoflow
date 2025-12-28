import React from 'react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';

const Analytics: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Análises</h1>
          <p className="text-gray-600 mt-1">Análise detalhada de vendas e produtos</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Tendência de Vendas">
            <div className="h-64 flex items-center justify-center text-gray-500">
              Gráfico de tendências - Integrado com Recharts
            </div>
          </Card>

          <Card title="Performance por Categoria">
            <div className="h-64 flex items-center justify-center text-gray-500">
              Gráfico de categorias - Integrado com Recharts
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Analytics;
