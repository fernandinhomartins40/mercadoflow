# 🌐 MercadoFlow Intelligence Platform - Aplicação Web

Uma plataforma web completa para análise de dados de vendas de supermercados, desenvolvida com TypeScript, Node.js, React e Docker.

## 📋 Visão Geral

A **MercadoFlow Intelligence Platform** é uma solução completa de analytics e business intelligence para o setor de varejo, especialmente supermercados. A plataforma processa dados de vendas (NFe/NFCe) em tempo real e fornece insights acionáveis através de algoritmos de Machine Learning e análises avançadas.

### 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     nginx       │    │   Backend API   │
│   React + TS    │◄──►│  Reverse Proxy  │◄──►│   Node.js + TS  │
│   Dashboard     │    │   Load Balancer │    │   REST API      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │     Redis       │    │     SQLite      │
                       │  Cache/Session  │◄──►│   Database      │
                       │   Rate Limit    │    │   Prisma ORM    │
                       └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Cron Jobs     │    │   Desktop App   │
                       │  Analytics/ML   │    │   Data Source   │
                       │  Background     │    │   XML Ingestion │
                       └─────────────────┘    └─────────────────┘
```

## ✨ Funcionalidades Principais

### 🔐 Autenticação e Autorização
- **JWT-based authentication** com refresh tokens
- **Role-based access control** (RBAC)
- **Multi-tenant** support (Markets e Industries)
- **Rate limiting** e proteção contra ataques
- **Session management** com Redis

### 📊 Ingestão de Dados
- **API REST** para recebimento de XMLs processados
- **Validação robusta** de dados NFe/NFCe
- **Processamento em lote** (batch processing)
- **Detecção de duplicatas** e validação de integridade
- **Suporte a versões** 3.10 e 4.00 de NFe

### 🧠 Analytics e Machine Learning
- **Market Basket Analysis** (algoritmo Apriori)
- **Demand Forecasting** com séries temporais
- **Price Elasticity Analysis**
- **Product Clustering** com K-Means
- **Seasonal Analysis** e tendências
- **Anomaly Detection** para identificar padrões suspeitos

### 🚨 Sistema de Alertas Inteligentes
- **Alertas automáticos** baseados em regras de negócio
- **Priorização** por impacto financeiro
- **Tipos de alertas**: Estoque baixo, produtos encalhados, oportunidades promocionais
- **Notificações** em tempo real

### 📈 Dashboard de Analytics
- **Métricas em tempo real** de vendas
- **Visualizações interativas** com gráficos
- **Top produtos** e análises de performance
- **Comparações temporais** e crescimento
- **Export de dados** para Excel/CSV

### 🏭 Portal da Indústria
- **Analytics regionais** de performance de produtos
- **Marketplace de oportunidades** comerciais
- **Gestão de campanhas** promocionais
- **Contato direto** com supermercados

## 🚀 Tecnologias Utilizadas

### Backend
- **Node.js 20** + **TypeScript 5**
- **Express.js** - Framework web
- **Prisma ORM** - Database ORM com SQLite
- **Redis** - Cache e session store
- **JWT** - Autenticação
- **Zod** - Validação de schemas
- **Winston** - Logging estruturado
- **bcryptjs** - Hash de senhas
- **node-cron** - Jobs agendados

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **React Query** - State management e cache
- **React Router DOM** - Roteamento
- **Tailwind CSS** - Styling
- **Recharts** - Gráficos e visualizações
- **React Hook Form** - Formulários
- **Framer Motion** - Animações

### DevOps e Infraestrutura
- **Docker** + **Docker Compose**
- **nginx** - Reverse proxy e load balancer
- **Let's Encrypt** - SSL/TLS certificates
- **Prometheus** + **Grafana** - Monitoramento (opcional)
- **GitHub Actions** - CI/CD pipeline

## 📦 Estrutura do Projeto

```
MercadoFlow.Web/
├── backend/                    # API Backend Node.js
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, logging, validation
│   │   ├── types/             # TypeScript definitions
│   │   ├── jobs/              # Background jobs
│   │   └── config/            # Configuration
│   ├── prisma/                # Database schema e migrations
│   ├── tests/                 # Unit e integration tests
│   └── Dockerfile
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── pages/             # Páginas principais
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API calls
│   │   ├── types/             # TypeScript definitions
│   │   └── utils/             # Helpers
│   └── Dockerfile
├── nginx/                      # nginx configuration
├── docker/                     # Docker configurations
├── docs/                       # Documentação
├── docker-compose.yml          # Orquestração completa
└── README.md
```

## 🛠️ Instalação e Setup

### Pré-requisitos
- **Docker** 24+ e **Docker Compose** 2+
- **Node.js** 20+ (para desenvolvimento local)
- **Git**

### 1. Clone o Repositório
```bash
git clone https://github.com/mercadoflow/platform
cd MercadoFlow.Web
```

### 2. Configuração de Ambiente
```bash
# Copie os arquivos de ambiente
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure as variáveis necessárias
nano .env
```

### 3. Deploy com Docker (Produção)
```bash
# Build e start de todos os serviços
docker-compose up -d

# Verificar status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f
```

### 4. Desenvolvimento Local
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

## 📊 APIs Principais

### 🔐 Autenticação
```bash
# Login
POST /api/v1/auth/login
{
  "email": "user@mercadoflow.com",
  "password": "senha123"
}

# Refresh token
POST /api/v1/auth/refresh
{
  "refreshToken": "jwt_refresh_token"
}

# Profile
GET /api/v1/auth/profile
Authorization: Bearer jwt_token
```

### 📥 Ingestão de Dados
```bash
# Single invoice
POST /api/v1/ingest/invoice
Authorization: Bearer jwt_token
{
  "chaveNFe": "35240114200166000187550010000000271501015504",
  "marketId": "uuid-market-id",
  "agentVersion": "1.0.0",
  "rawXmlHash": "sha256_hash",
  "invoice": { ... }
}

# Batch processing
POST /api/v1/ingest/batch
Authorization: Bearer jwt_token
{
  "invoices": [...],
  "processOptions": {
    "skipDuplicates": true,
    "validateSchema": true
  }
}
```

### 📈 Dashboard
```bash
# Dashboard metrics
GET /api/v1/dashboard/metrics?period=30d
Authorization: Bearer jwt_token

# Top products
GET /api/v1/dashboard/top-products?limit=10
Authorization: Bearer jwt_token

# Sales trends
GET /api/v1/dashboard/sales-trends?period=7d
Authorization: Bearer jwt_token
```

## 🔍 Algoritmos de Machine Learning

### 1. Market Basket Analysis (Apriori)
```typescript
// Parâmetros configuráveis
{
  minSupport: 0.01,        // 1% das transações
  minConfidence: 0.5,      // 50% de confiança
  maxRules: 100            // Máximo de regras
}

// Resultado
{
  antecedent: ["Produto A"],
  consequent: ["Produto B"],
  support: 0.02,           // 2% das transações
  confidence: 0.75,        // 75% de confiança
  lift: 1.5               // 50% acima do esperado
}
```

### 2. Demand Forecasting
```typescript
// Métodos implementados
- Moving Average (7, 14, 30 dias)
- Exponential Smoothing
- Linear Regression com features sazonais
- Seasonal Decomposition

// Features utilizadas
- Vendas históricas
- Sazonalidade (dia da semana, mês)
- Promoções anteriores
- Tendências de categoria
```

### 3. Price Elasticity
```typescript
// Cálculo da elasticidade
elasticity = (% mudança quantidade) / (% mudança preço)

// Categorias
- elastic: |elasticity| > 1
- inelastic: |elasticity| < 1
- perfectly_elastic: elasticity = ∞
- perfectly_inelastic: elasticity = 0
```

## 🚨 Sistema de Alertas

### Regras de Negócio Implementadas

#### Estoque Baixo (LOW_STOCK)
```typescript
trigger: vendas_7_dias > estoque_atual / tempo_reposicao
priority: HIGH se < 3 dias, MEDIUM se < 7 dias
```

#### Produto Encalhado (SLOW_MOVING)
```typescript
trigger: zero_vendas_30_dias && estoque > 0
priority: HIGH se perecível, MEDIUM caso contrário
```

#### Oportunidade Promocional (PROMOTION_OPPORTUNITY)
```typescript
trigger: alta_elasticidade && vendas < media_sazonal
priority: MEDIUM se produto sazonal, LOW caso contrário
```

#### Risco de Vencimento (EXPIRATION_RISK)
```typescript
trigger: vencimento < 15_dias && estoque > venda_media_diaria
priority: URGENT se perecível, HIGH caso contrário
```

## 📊 Métricas e KPIs

### Técnicos
- **API Response Time**: < 200ms (p95)
- **XML Processing Time**: < 30 segundos
- **Dashboard Load Time**: < 3 segundos
- **System Uptime**: > 99.5%
- **Error Rate**: < 1%

### Negócio
- **Taxa de Processamento**: > 99% success rate
- **Alertas Gerados**: Por tipo e prioridade
- **Usuários Ativos**: DAU/MAU
- **Insights Acionáveis**: Métricas de adoção

## 🔒 Segurança

### Implementações de Segurança
- **HTTPS obrigatório** com TLS 1.2+
- **JWT** com refresh tokens e blacklist
- **Rate limiting** por endpoint e usuário
- **CORS** configurado adequadamente
- **Input validation** com Zod schemas
- **SQL injection protection** via Prisma ORM
- **XSS protection** com Content Security Policy
- **Password hashing** com bcrypt (12 rounds)
- **RBAC** com controle granular de acesso

### Headers de Segurança
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000
Content-Security-Policy: [política configurada]
```

## 📈 Performance e Escalabilidade

### Otimizações Implementadas
- **Connection pooling** para banco de dados
- **Redis caching** para dados frequentes
- **Compression GZIP** para responses
- **Database indexing** otimizado
- **Lazy loading** no frontend
- **Code splitting** para bundles menores
- **CDN ready** para assets estáticos

### Benchmarks
- **Throughput**: 1000+ requests/segundo
- **Concurrent Users**: 500+ simultâneos
- **Data Processing**: 10,000+ XMLs/hora
- **Memory Usage**: < 512MB por container
- **Database**: < 50ms query response

## 🐳 Deploy e Monitoramento

### Deploy em Produção
```bash
# Configurar ambiente
export NODE_ENV=production
export JWT_SECRET=your_secure_secret
export DATABASE_URL=file:./data/production.db

# Deploy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verificar saúde
curl https://api.mercadoflow.com/api/v1/health
```

### Monitoramento
```bash
# Health checks disponíveis
GET /api/v1/health           # Basic health
GET /api/v1/health/detailed  # Detailed metrics
GET /api/v1/health/ready     # Kubernetes readiness
GET /api/v1/health/live      # Kubernetes liveness
GET /api/v1/health/metrics   # Prometheus metrics
```

### Logs
```bash
# Logs estruturados em JSON
docker-compose logs backend | jq '.'

# Filtrar por nível
docker-compose logs backend | jq 'select(.level == "error")'

# Monitorar em tempo real
docker-compose logs -f --tail=100 backend
```

## 📚 Documentação da API

### Swagger/OpenAPI
A documentação completa da API está disponível em:
- **Desenvolvimento**: http://localhost:3000/api/v1/docs
- **Produção**: https://api.mercadoflow.com/api/v1/docs

### Postman Collection
Importe a collection do Postman disponível em `/docs/postman/` para testar os endpoints.

## 🧪 Testes

### Executar Testes
```bash
# Backend unit tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Estrutura de Testes
- **Unit Tests**: Serviços, utilities, helpers
- **Integration Tests**: API endpoints, database
- **E2E Tests**: Fluxos críticos de usuário
- **Load Tests**: Performance e stress testing

## 🤝 Contribuição

### Guidelines
1. **Fork** o repositório
2. **Crie** uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** suas mudanças (`git commit -am 'Add nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
5. **Abra** um Pull Request

### Padrões de Código
- **TypeScript strict mode** habilitado
- **ESLint** + **Prettier** para formatação
- **Conventional Commits** para mensagens
- **100% test coverage** para features críticas
- **JSDoc** para documentação de funções

## 📄 Licença

Copyright © 2024 MercadoFlow Intelligence. Todos os direitos reservados.

Este software é proprietário e seu uso está sujeito aos termos do contrato de licença.

---

**Versão**: 1.0.0
**Última Atualização**: Janeiro 2024
**Compatibilidade**: Docker 24+, Node.js 20+

Para suporte técnico: suporte@mercadoflow.com
Para documentação adicional: https://docs.mercadoflow.com