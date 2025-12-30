import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { marketService } from '../services/marketService';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

const Market: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: basketData, isLoading: isBasketLoading } = useQuery({
    queryKey: ['market-basket', user?.marketId],
    queryFn: () => marketService.getMarketBasketAnalysis(user?.marketId)
  });

  const { data: marketList, isLoading: isMarketListLoading, isError: isMarketListError, error: marketListError } = useQuery({
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
  const [marketError, setMarketError] = useState<string | null>(null);
  const [pdvError, setPdvError] = useState<string | null>(null);

  const canManageMarkets = user?.role === UserRole.MARKET_OWNER || user?.role === UserRole.ADMIN;
  const markets = marketList?.markets ?? [];
  const isMarketValid = !!marketForm.name && !!marketForm.address && !!marketForm.city && !!marketForm.state && !!marketForm.region;
  const isPdvValid = !!pdvForm.marketId && !!pdvForm.name && !!pdvForm.identifier;

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const anyError = error as any;
      return anyError?.response?.data?.error?.message || anyError?.message || fallback;
    }
    return fallback;
  };

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
      setMarketError(null);
      queryClient.invalidateQueries({ queryKey: ['markets-list'] });
      toast.success('Supermercado cadastrado com sucesso.');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Falha ao cadastrar supermercado.');
      setMarketError(message);
      toast.error(message);
    }
  });

  const createPdv = useMutation({
    mutationFn: () => marketService.createPdv(pdvForm.marketId, {
      name: pdvForm.name,
      identifier: pdvForm.identifier
    }),
    onSuccess: () => {
      setPdvForm({ marketId: pdvForm.marketId, name: '', identifier: '' });
      setPdvError(null);
      queryClient.invalidateQueries({ queryKey: ['markets-list'] });
      toast.success('PDV cadastrado com sucesso.');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Falha ao cadastrar PDV.');
      setPdvError(message);
      toast.error(message);
    }
  });

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === pdvForm.marketId),
    [markets, pdvForm.marketId]
  );

  if (isBasketLoading) return <MainLayout><Spinner size="xl" text="Carregando..." /></MainLayout>;

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
                  disabled={createMarket.isPending || !isMarketValid}
                  onClick={() => {
                    if (!isMarketValid) {
                      const message = 'Preencha os campos obrigatorios do supermercado.';
                      setMarketError(message);
                      toast.error(message);
                      return;
                    }
                    createMarket.mutate();
                  }}
                >
                  {createMarket.isPending ? 'Salvando...' : 'Cadastrar supermercado'}
                </button>
                {marketError && <p className="text-sm text-red-600">{marketError}</p>}
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
                  disabled={createPdv.isPending || !isPdvValid}
                  onClick={() => {
                    if (!isPdvValid) {
                      const message = 'Selecione o supermercado e preencha nome e identificador.';
                      setPdvError(message);
                      toast.error(message);
                      return;
                    }
                    createPdv.mutate();
                  }}
                >
                  {createPdv.isPending ? 'Salvando...' : 'Cadastrar PDV'}
                </button>
                {selectedMarket && (
                  <p className="text-sm text-gray-500">PDVs atuais: {selectedMarket.pdvCount}</p>
                )}
                {pdvError && <p className="text-sm text-red-600">{pdvError}</p>}
              </div>
            </div>
            {isMarketListLoading && <p className="text-sm text-gray-500 mt-4">Carregando mercados...</p>}
            {isMarketListError && (
              <p className="text-sm text-red-600 mt-2">
                {getErrorMessage(marketListError, 'Falha ao carregar mercados.')}
              </p>
            )}
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
