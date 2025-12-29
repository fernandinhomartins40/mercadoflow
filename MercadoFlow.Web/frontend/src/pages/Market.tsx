import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { marketService } from '../services/marketService';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

const Market: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: basketData, isLoading } = useQuery({
    queryKey: ['market-basket', user?.marketId],
    queryFn: () => marketService.getMarketBasketAnalysis(user?.marketId)
  });

  const { data: marketList } = useQuery({
    queryKey: ['markets-list'],
    queryFn: () => marketService.getMarkets(),
    enabled: !!user
  });

  const [marketForm, setMarketForm] = useState({
    name: '',
    cnpj: '',
    address: '',
    city: '',
    state: '',
    region: ''
  });

  const [pdvForm, setPdvForm] = useState({
    marketId: '',
    name: '',
    identifier: ''
  });

  const canManageMarkets = user?.role === UserRole.MARKET_OWNER || user?.role === UserRole.ADMIN;
  const markets = marketList?.markets ?? [];

  const createMarket = useMutation({
    mutationFn: () => marketService.createMarket({
      name: marketForm.name,
      cnpj: marketForm.cnpj || undefined,
      address: marketForm.address,
      city: marketForm.city,
      state: marketForm.state,
      region: marketForm.region
    }),
    onSuccess: () => {
      setMarketForm({ name: '', cnpj: '', address: '', city: '', state: '', region: '' });
      queryClient.invalidateQueries({ queryKey: ['markets-list'] });
    }
  });

  const createPdv = useMutation({
    mutationFn: () => marketService.createPdv(pdvForm.marketId, {
      name: pdvForm.name,
      identifier: pdvForm.identifier
    }),
    onSuccess: () => {
      setPdvForm({ marketId: pdvForm.marketId, name: '', identifier: '' });
      queryClient.invalidateQueries({ queryKey: ['markets-list'] });
    }
  });

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === pdvForm.marketId),
    [markets, pdvForm.marketId]
  );

  if (isLoading) return <MainLayout><Spinner size="xl" text="Carregando..." /></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inteligencia de Mercado</h1>
          <p className="text-gray-600 mt-1">Analise de cesta de mercado e associacoes de produtos</p>
        </div>

        {canManageMarkets && (
          <Card title="Cadastro de Supermercados e PDVs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Novo supermercado</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Nome"
                    value={marketForm.name}
                    onChange={(e) => setMarketForm({ ...marketForm, name: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="CNPJ (opcional)"
                    value={marketForm.cnpj}
                    onChange={(e) => setMarketForm({ ...marketForm, cnpj: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2 md:col-span-2"
                    placeholder="Endereco"
                    value={marketForm.address}
                    onChange={(e) => setMarketForm({ ...marketForm, address: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Cidade"
                    value={marketForm.city}
                    onChange={(e) => setMarketForm({ ...marketForm, city: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="UF"
                    value={marketForm.state}
                    onChange={(e) => setMarketForm({ ...marketForm, state: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Regiao"
                    value={marketForm.region}
                    onChange={(e) => setMarketForm({ ...marketForm, region: e.target.value })}
                  />
                </div>
                <button
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                  disabled={createMarket.isPending}
                  onClick={() => createMarket.mutate()}
                >
                  {createMarket.isPending ? 'Salvando...' : 'Cadastrar supermercado'}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Novo PDV (caixa)</h3>
                <div className="grid grid-cols-1 gap-3">
                  <select
                    className="border rounded-lg px-3 py-2"
                    value={pdvForm.marketId}
                    onChange={(e) => setPdvForm({ ...pdvForm, marketId: e.target.value })}
                  >
                    <option value="">Selecione o supermercado</option>
                    {markets.map((market) => (
                      <option key={market.id} value={market.id}>
                        {market.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Nome do PDV"
                    value={pdvForm.name}
                    onChange={(e) => setPdvForm({ ...pdvForm, name: e.target.value })}
                  />
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Identificador (ex: PDV-001)"
                    value={pdvForm.identifier}
                    onChange={(e) => setPdvForm({ ...pdvForm, identifier: e.target.value })}
                  />
                </div>
                <button
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                  disabled={createPdv.isPending || !pdvForm.marketId}
                  onClick={() => createPdv.mutate()}
                >
                  {createPdv.isPending ? 'Salvando...' : 'Cadastrar PDV'}
                </button>
                {selectedMarket && (
                  <p className="text-sm text-gray-500">PDVs atuais: {selectedMarket.pdvCount}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        <Card title="Associacoes de Produtos">
          <div className="text-center text-gray-600">Analise de market basket funcional</div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Market;
