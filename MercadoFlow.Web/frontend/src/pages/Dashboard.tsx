import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            MercadoFlow Intelligence
          </h1>
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Dashboard Principal
                </h2>
                <p className="text-gray-600">
                  Bem-vindo ao MercadoFlow Intelligence Platform
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Sistema de análise avançada de dados de varejo
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;