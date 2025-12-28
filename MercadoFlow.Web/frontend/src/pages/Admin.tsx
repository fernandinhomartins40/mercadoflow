import React from 'react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';
import { Navigate } from 'react-router-dom';

const Admin: React.FC = () => {
  const { user } = useAuth();
  
  if (user?.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600 mt-1">Gerenciamento do sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Usuários">
            <div className="text-center text-gray-600 py-8">Gerenciamento de usuários</div>
          </Card>

          <Card title="Mercados">
            <div className="text-center text-gray-600 py-8">Gerenciamento de mercados</div>
          </Card>
        </div>

        <Card title="Saúde do Sistema">
          <div className="text-center text-gray-600 py-8">Status e monitoramento do sistema</div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Admin;
