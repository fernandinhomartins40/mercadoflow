import React from 'react';

const Market: React.FC = () => {
  return (
    <div className="market">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Market Intelligence
          </h1>
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Inteligência de Mercado
                </h2>
                <p className="text-gray-600">
                  Análise de tendências e comportamento de mercado
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Market;