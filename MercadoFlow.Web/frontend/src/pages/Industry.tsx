import React from 'react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';

const Industry: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Industry Benchmarks</h1>
          <p className="text-gray-600 mt-1">Compare seu desempenho com a média do setor</p>
        </div>
        <Card title="Benchmarks do Setor">
          <div className="text-center text-gray-600 py-8">Comparação com indústria</div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Industry;
