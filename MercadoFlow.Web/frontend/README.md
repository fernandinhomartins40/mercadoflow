# MercadoFlow Web Frontend

Frontend da plataforma MercadoFlow Intelligence - Sistema de análise avançada de dados de varejo.

## 🚀 Tecnologias

- **React 18** - Library UI
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **React Query** - Data Fetching
- **React Hook Form** - Form Management
- **Zod** - Validation
- **Axios** - HTTP Client
- **Recharts** - Data Visualization

## 📦 Estrutura do Projeto

```
src/
├── components/
│   ├── auth/           # Componentes de autenticação
│   ├── ui/             # Componentes UI reutilizáveis
│   └── layout/         # Componentes de layout
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── layouts/            # Layouts de página
├── pages/              # Páginas da aplicação
├── services/           # Serviços de API
├── types/              # TypeScript type definitions
├── utils/              # Funções utilitárias
└── styles/             # Estilos globais
```

## 🔑 Funcionalidades Implementadas

### Autenticação ✅
- Login com validação
- Registro de usuários
- Proteção de rotas
- Gerenciamento de tokens (JWT)
- Refresh token automático
- Logout

### Dashboard ✅
- Métricas principais (Receita, Transações, Ticket Médio)
- Top 10 produtos
- Alertas recentes
- Comparação com período anterior
- Filtros de data

### Analytics ✅
- Análise de tendências
- Performance por categoria
- Visualização de dados

### Market Intelligence ✅
- Análise de cesta de mercado
- Associações de produtos (Apriori algorithm)
- Suporte, confiança e lift

### Industry Benchmarks ✅
- Comparação com média do setor
- Métricas de performance

### Admin Panel ✅ (Apenas para ADMIN)
- Gerenciamento de usuários
- Gerenciamento de mercados
- Métricas do sistema

## 🔐 Credenciais de Teste

```
Admin:
  Email: admin@mercadoflow.com
  Senha: Admin@123

Market Owner:
  Email: dono@supermercadoabc.com
  Senha: Admin@123

Industry User:
  Email: contato@industriaxyz.com
  Senha: Admin@123
```

## 🛠️ Instalação e Uso

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Lint
npm run lint

# Type check
npm run type-check
```

## 🌐 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development
VITE_ENABLE_ANALYTICS=true
```

## 📱 Páginas Disponíveis

- `/login` - Login
- `/` - Dashboard (protegido)
- `/analytics` - Analytics (protegido)
- `/market` - Market Intelligence (protegido)
- `/industry` - Industry Benchmarks (protegido)
- `/admin` - Admin Panel (protegido, apenas ADMIN)

## 🎨 Componentes UI

### Card
```tsx
<Card title="Título" subtitle="Subtítulo">
  Conteúdo
</Card>
```

### Badge
```tsx
<Badge variant="success|warning|error|info|default">
  Texto
</Badge>
```

### Spinner
```tsx
<Spinner size="sm|md|lg|xl" text="Carregando..." />
```

## 🔗 Integração com API

Todos os serviços estão em `src/services/`:

- `authService.ts` - Autenticação
- `dashboardService.ts` - Dashboard
- `marketService.ts` - Market Intelligence
- `analyticsService.ts` - Analytics

## 📊 Estado da Implementação

- ✅ Autenticação completa
- ✅ Tipos TypeScript completos
- ✅ Componentes UI básicos
- ✅ Layouts responsivos
- ✅ Integração com API
- ✅ Todas as páginas funcionais
- ⚠️ Testes (estrutura pronta, testes a implementar)
- ⚠️ Gráficos completos com Recharts (estrutura pronta)

## 🚧 Próximos Passos

1. Implementar gráficos completos com Recharts
2. Adicionar testes unitários e E2E
3. Implementar funcionalidades avançadas de filtros
4. Adicionar modo escuro
5. Melhorar responsividade mobile

## 📝 Licença

Propriedade de MercadoFlow Intelligence Platform
