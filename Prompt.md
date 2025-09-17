# Prompt para Claude Code - Implementação PDV2Cloud Intelligence

## Instrução Principal para Claude Code

Implemente uma solução completa para coleta e análise de dados de vendas de supermercados, dividida em duas partes principais: **Aplicação Desktop (Coletor)** e **Plataforma Web com API**. Forneça código, configurações, scripts de deploy e documentação completa.

---

## PARTE 1: APLICAÇÃO DESKTOP (COLETOR)

### Especificações Gerais
**Nome**: PDV2Cloud Collector Agent  
**Objetivo**: Coletar XMLs de NF-e/NFC-e dos PDVs e enviar para a nuvem  
**Plataforma**: Windows (foco principal)  
**Stack Recomendada**: C# (.NET 7/8) + WPF  

### Funcionalidades Obrigatórias

#### 1. Monitoramento de Arquivos
- **File System Watcher**: Monitorar múltiplas pastas configuráveis
- **Filtros**: Apenas arquivos .xml, .zip (XMLs compactados)
- **Debounce**: Aguardar arquivo parar de ser escrito antes de processar
- **Exclusão**: Ignorar arquivos temporários e de sistema

#### 2. Parser de XML
- **Formatos**: NF-e e NFC-e (versões 3.10 e 4.00)
- **Campos Obrigatórios**:
  - Chave da NF-e (44 dígitos)
  - CNPJ/CPF do emitente
  - Data/hora de emissão
  - Série e número da nota
  - Valor total
  - CPF/CNPJ do destinatário (quando disponível)

- **Itens da Nota**:
  - Código EAN/GTIN
  - Código interno do produto
  - Descrição do produto
  - NCM (classificação fiscal)
  - CFOP (código fiscal)
  - Quantidade
  - Valor unitário
  - Valor total do item
  - ICMS, PIS, COFINS (quando disponível)

#### 3. Validação e Normalização
- **Validar XMLDSig**: Verificar integridade da assinatura digital
- **Schema Validation**: Validar contra XSD da Fazenda
- **Normalização**: Converter dados para JSON padronizado
- **Sanitização**: Remover caracteres especiais, padronizar encoding

#### 4. Armazenamento Local (Fila/Outbox)
- **SQLite Local**: Tabela para armazenar payloads pendentes
- **Campos**: id, chave_nfe, payload_json, status, tentativas, data_criacao, data_processamento, erro_detalhes
- **Status**: PENDING, PROCESSING, SENT, ERROR, DEAD_LETTER

#### 5. Transmissão para Cloud
- **Protocolo**: HTTPS obrigatório (TLS 1.2+)
- **Endpoint**: POST /api/v1/ingest/invoice
- **Autenticação**: Bearer token + HMAC SHA-256 (opcional)
- **Headers**: Content-Type: application/json, X-Agent-Version, X-Market-ID
- **Retry Logic**: Backoff exponencial (1s, 2s, 4s, 8s, 16s)
- **Dead Letter**: Após 5 tentativas, marcar como erro e alertar

#### 6. Interface de Usuário (WPF)
- **Status Dashboard**: Conectividade, último processamento, estatísticas
- **Configuração**: Pastas monitoradas, endpoint API, credenciais
- **Log Viewer**: Últimos arquivos processados com status
- **Controles**: Start/Stop service, teste de conectividade
- **Alerta Visual**: Indicadores de erro, sucesso e avisos

#### 7. Configuração e Setup
- **Arquivo Config**: appsettings.json para configurações
- **Registry/DPAPI**: Criptografar credenciais sensíveis
- **Auto-start**: Opção de iniciar com Windows
- **Updates**: Auto-updater integrado

#### 8. Tratamento de Cenários Especiais
- **Modo Offline**: Continuar coletando quando sem internet
- **XMLs Compactados**: Suporte a .zip com múltiplos XMLs
- **Bancos de Dados**: Conectores para SQLite/Firebird (ler XMLs armazenados como BLOB)
- **Duplicatas**: Detectar e ignorar XMLs já processados

#### 9. Logging e Monitoramento
- **Logs Estruturados**: NLog ou Serilog
- **Rotação**: Logs por tamanho (10MB) e tempo (7 dias)
- **Métricas**: Arquivos processados/hora, erros, latência
- **Health Check**: Endpoint local para monitoramento

#### 10. Segurança
- **Certificados**: Validar certificados SSL da API
- **Criptografia**: Dados sensíveis criptografados em disco
- **Sandbox**: Executar com privilégios mínimos
- **Auditoria**: Log de todas as ações do usuário

---

## PARTE 2: PLATAFORMA WEB + API

### Especificações Gerais
**Stack Obrigatória**: TypeScript + nginx (reverse proxy) + Docker containers + Node.js + Prisma + SQLite 3  
**Arquitetura**: Monolito modular em containers  

### Infraestrutura e Deploy

#### 1. Docker Setup
- **nginx Container**: Reverse proxy, SSL termination, load balancing
- **Node.js API Container**: Backend principal
- **SQLite Volume**: Persistência de dados
- **Redis Container**: Cache e sessões
- **Cron Container**: Jobs e analytics

#### 2. nginx Configuração
- **Reverse Proxy**: Rotear /api/* para backend
- **Static Files**: Servir frontend diretamente
- **SSL/TLS**: Certificados Let's Encrypt
- **Rate Limiting**: API calls por IP/token
- **CORS**: Configuração adequada para frontend

### Backend API (Node.js + TypeScript)

#### 1. Estrutura do Projeto
```
src/
├── controllers/     # Route handlers
├── services/        # Business logic
├── middleware/      # Auth, validation, logging
├── models/          # Prisma schemas
├── utils/           # Helpers
├── jobs/            # Background jobs
├── config/          # Configuration
└── types/           # TypeScript definitions
```

#### 2. Prisma Schema (Entidades Principais)

**Users & Authentication**
```typescript
User {
  id: String (UUID)
  email: String (unique)
  password: String (hashed)
  name: String
  role: Enum (ADMIN, MARKET_OWNER, MARKET_MANAGER, INDUSTRY_USER)
  marketId: String? (FK)
  industryId: String? (FK)
  isActive: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Markets & PDVs**
```typescript
Market {
  id: String (UUID)
  name: String
  cnpj: String? (unique)
  address: String
  city: String
  state: String
  region: String
  ownerId: String (FK to User)
  planType: Enum (BASIC, INTERMEDIATE, ADVANCED)
  isActive: Boolean
  createdAt: DateTime
}

PDV {
  id: String (UUID)
  marketId: String (FK)
  name: String
  identifier: String
  isActive: Boolean
}
```

**Invoices & Items**
```typescript
Invoice {
  id: String (UUID)
  chaveNFe: String (unique)
  marketId: String (FK)
  pdvId: String (FK)
  serie: String
  numero: String
  dataEmissao: DateTime
  cnpjEmitente: String
  cpfCnpjDestinatario: String?
  valorTotal: Decimal
  rawXmlHash: String
  processedAt: DateTime
}

InvoiceItem {
  id: String (UUID)
  invoiceId: String (FK)
  productId: String? (FK)
  codigoEAN: String
  codigoInterno: String
  descricao: String
  ncm: String
  cfop: String
  quantidade: Decimal
  valorUnitario: Decimal
  valorTotal: Decimal
  icms: Decimal?
  pis: Decimal?
  cofins: Decimal?
}
```

**Products & Analytics**
```typescript
Product {
  id: String (UUID)
  ean: String (unique)
  name: String
  category: String
  brand: String?
  unit: String
  createdAt: DateTime
}

SalesAnalytics {
  id: String (UUID)
  marketId: String (FK)
  productId: String (FK)
  date: DateTime
  quantitySold: Decimal
  revenue: Decimal
  averagePrice: Decimal
  transactionCount: Int
}

MarketBasket {
  id: String (UUID)
  marketId: String (FK)
  product1Id: String (FK)
  product2Id: String (FK)
  support: Decimal
  confidence: Decimal
  lift: Decimal
  analyzedAt: DateTime
}
```

**Alerts & Campaigns**
```typescript
Alert {
  id: String (UUID)
  marketId: String (FK)
  type: Enum (LOW_STOCK, HIGH_PERFORMING, SLOW_MOVING, EXPIRATION_RISK, PROMOTION_OPPORTUNITY)
  title: String
  message: String
  productId: String? (FK)
  priority: Enum (LOW, MEDIUM, HIGH, URGENT)
  isRead: Boolean
  createdAt: DateTime
}

Industry {
  id: String (UUID)
  name: String
  cnpj: String (unique)
  segment: String
  isActive: Boolean
}

Campaign {
  id: String (UUID)
  industryId: String (FK)
  title: String
  description: String
  productIds: String[] (JSON array)
  targetRegions: String[] (JSON array)
  startDate: DateTime
  endDate: DateTime
  budget: Decimal
  status: Enum (DRAFT, ACTIVE, PAUSED, COMPLETED)
}
```

#### 3. API Endpoints

**Authentication**
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET /api/v1/auth/profile

**Data Ingestion**
- POST /api/v1/ingest/invoice (recebe dados do agent desktop)
- POST /api/v1/ingest/batch (múltiplas invoices)

**Markets Dashboard**
- GET /api/v1/markets/:id/dashboard
- GET /api/v1/markets/:id/products
- GET /api/v1/markets/:id/alerts
- GET /api/v1/markets/:id/analytics/top-sellers
- GET /api/v1/markets/:id/analytics/market-basket
- GET /api/v1/markets/:id/analytics/seasonal-trends

**Industries Portal**
- GET /api/v1/industries/analytics/regional
- GET /api/v1/industries/markets/search
- POST /api/v1/industries/campaigns
- GET /api/v1/industries/campaigns/:id/performance

**Admin**
- GET/POST/PUT/DELETE /api/v1/admin/users
- GET/POST/PUT/DELETE /api/v1/admin/markets
- GET /api/v1/admin/system/health

#### 4. Background Jobs (Cron Jobs)

**Analytics Jobs**
- **Daily Aggregation** (02:00): Calcular vendas diárias por produto/market
- **Weekly Market Basket** (Domingo 03:00): Executar análise de cesta de compras
- **Monthly Seasonal Analysis** (1º dia 04:00): Identificar tendências sazonais
- **Alert Generation** (A cada hora): Gerar alertas baseados em regras

**ML/IA Processing**
- **Demand Forecasting**: Previsão de demanda por produto/época
- **Price Elasticity**: Análise de sensibilidade a preços
- **Product Clustering**: Agrupamento de produtos similares
- **Churn Prediction**: Identificar produtos em risco de abandono

#### 5. Business Logic Services

**Analytics Service**
- Calcular métricas de vendas (top sellers, growth, etc.)
- Detectar produtos em risco de vencimento
- Identificar oportunidades promocionais
- Análise de duplas/trios de produtos

**ML Service**
- Implementar algoritmos básicos (Apriori para market basket)
- Previsões com séries temporais
- Clustering de produtos
- Detecção de anomalias em vendas

**Alert Service**
- Regras para geração automática de alertas
- Priorização baseada em impacto financeiro
- Notificações push/email (opcional)

#### 6. Middleware e Utilitários

**Authentication Middleware**
- JWT validation
- Role-based access control (RBAC)
- Rate limiting por usuário/role

**Validation Middleware**
- Request schema validation (Zod)
- Sanitização de inputs
- Error handling padronizado

**Logging Middleware**
- Request/response logging
- Performance metrics
- Error tracking

### Frontend Web (React + TypeScript)

#### 1. Estrutura do Projeto
```
src/
├── components/      # Componentes reutilizáveis
├── pages/          # Páginas/rotas principais
├── hooks/          # Custom hooks
├── services/       # API calls
├── types/          # TypeScript definitions
├── utils/          # Helpers
├── context/        # React context
└── styles/         # CSS/Styled components
```

#### 2. Páginas Principais

**Dashboard Supermercado**
- Cards de métricas principais (vendas hoje/mês, produtos top)
- Alertas em destaque (produtos em risco, oportunidades)
- Gráficos de tendências (vendas por período)
- Lista de produtos mais vendidos

**Análise de Produtos**
- Tabela paginada com filtros (categoria, período, performance)
- Detalhes por produto (histórico, sazonalidade, margin)
- Comparação entre produtos
- Sugestões de promoção

**Market Basket Analysis**
- Visualização de duplas/trios frequentes
- Sugestões de layout/posicionamento
- Impacto de produtos âncora

**Gestão de Alertas**
- Lista de alertas por prioridade
- Filtros por tipo e status
- Ações disponíveis (marcar como lido, criar promoção)

**Portal da Indústria**
- Dashboard regional (onde produtos vendem mais)
- Performance de campanhas ativas
- Marketplace de oportunidades
- Contato direto com supermercados

#### 3. Componentes Principais

**Cards de Métricas**
- Vendas período atual vs anterior
- Crescimento percentual
- Alertas não lidos
- Produtos em destaque

**Tabelas Inteligentes**
- Ordenação, filtros, paginação
- Export para Excel/CSV
- Ações em linha (detalhes, editar)

**Gráficos e Visualizações**
- Line charts para tendências temporais
- Bar charts para comparações
- Heatmaps para sazonalidade
- Network graphs para market basket

**Formulários**
- Configuração de alertas
- Criação de campanhas
- Gestão de usuários

#### 4. State Management
- React Context para dados globais (usuário, configurações)
- React Query para cache de API calls
- Local state com useState/useReducer

#### 5. Styling
- CSS Modules ou Styled Components
- Design system consistente
- Responsivo (mobile-friendly)
- Dark/light mode (opcional)

### Integração e Deployment

#### 1. CI/CD Pipeline
- **GitHub Actions** ou **GitLab CI**
- Build automatizado para desktop app
- Build e push de containers Docker
- Deploy automatizado em staging/production

#### 2. Monitoramento
- **Application Performance Monitoring** (APM)
- **Error tracking** (Sentry)
- **Uptime monitoring**
- **Database performance**

#### 3. Backup e Recovery
- Backup automático do SQLite
- Replicação em cloud storage
- Disaster recovery plan

#### 4. Testing Strategy
- **Unit tests** para services/utils (Jest)
- **Integration tests** para API endpoints
- **E2E tests** para fluxos críticos (Playwright)
- **Desktop app testing** com frameworks C#

---

## DELIVERABLES ESPERADOS

### 1. Aplicação Desktop
- [ ] Código-fonte completo em C# (.NET)
- [ ] Instalador MSI/EXE
- [ ] Documentação de instalação e configuração
- [ ] Manual do usuário

### 2. Plataforma Web
- [ ] Código-fonte completo (TypeScript/Node.js/React)
- [ ] docker-compose.yml para deployment
- [ ] nginx.conf otimizada
- [ ] Scripts de migração Prisma
- [ ] Seeds/fixtures para desenvolvimento

### 3. Documentação
- [ ] README detalhado com setup instructions
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Diagrama de arquitetura
- [ ] Guia de troubleshooting

### 4. Scripts e Automação
- [ ] Scripts de build e deploy
- [ ] Health check scripts
- [ ] Backup/restore procedures
- [ ] Environment setup scripts

---

## CONSIDERAÇÕES IMPORTANTES

1. **Performance**: Sistema deve processar 1000+ XMLs/hora por PDV
2. **Segurança**: HTTPS obrigatório, dados sensíveis criptografados
3. **Compliance**: Adequação à LGPD e regulamentos fiscais
4. **Escalabilidade**: Arquitetura preparada para milhares de usuários
5. **Usabilidade**: Interface intuitiva para usuários não-técnicos
6. **Reliability**: Uptime 99.5%+, recovery automático de falhas

Esta implementação deve resultar em uma solução robusta, escalável e pronta para produção, capaz de transformar dados de vendas em insights acionáveis que gerem valor real para supermercados e indústrias.

---

## CENÁRIOS DE TESTE E VALIDAÇÃO

### 1. Testes da Aplicação Desktop

**Cenários de Parser XML**
- [ ] NF-e versão 3.10 e 4.00 válidas
- [ ] NFC-e com diferentes layouts
- [ ] XMLs corrompidos ou mal formados
- [ ] XMLs compactados (.zip) com múltiplos arquivos
- [ ] XMLs muito grandes (>1MB)
- [ ] XMLs com caracteres especiais/encoding UTF-8

**Cenários de Conectividade**
- [ ] Operação normal com internet estável
- [ ] Perda de conectividade durante transmissão
- [ ] API indisponível (retry automático)
- [ ] Timeout de requisições
- [ ] Reconexão automática após queda

**Cenários de Sistema**
- [ ] Reinicialização do Windows
- [ ] Antivírus bloqueando arquivos
- [ ] Permissões insuficientes de pasta
- [ ] Disco cheio
- [ ] Múltiplas instâncias executando

### 2. Testes da API Backend

**Load Testing**
- [ ] 1000 requisições simultâneas /api/v1/ingest/invoice
- [ ] Processamento de lotes com 100+ XMLs
- [ ] Consultas complexas no dashboard
- [ ] Jobs de analytics com milhões de registros

**Security Testing**
- [ ] Injeção SQL via parâmetros
- [ ] Autenticação com tokens inválidos/expirados
- [ ] Rate limiting funcionando
- [ ] CORS adequadamente configurado
- [ ] Headers de segurança presentes

**Integration Testing**
- [ ] Fluxo completo: XML → Parser → API → Database → Dashboard
- [ ] Jobs de analytics executando corretamente
- [ ] Geração de alertas baseados em regras
- [ ] Sincronização entre múltiplos PDVs

### 3. Testes do Frontend

**User Experience**
- [ ] Dashboard carrega em <3 segundos
- [ ] Filtros aplicam instantaneamente
- [ ] Responsividade em mobile/tablet
- [ ] Acessibilidade (WCAG 2.1)
- [ ] Navegação intuitiva

**Data Visualization**
- [ ] Gráficos renderizam corretamente
- [ ] Dados em tempo real (WebSocket/polling)
- [ ] Export para Excel funcional
- [ ] Tratamento de datasets vazios

---

## ALGORITMOS DE IA E ANALYTICS

### 1. Market Basket Analysis (Algoritmo Apriori)

**Implementação Simplificada**
```typescript
interface BasketItem {
  transactionId: string;
  productIds: string[];
}

interface AssociationRule {
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
}

// Parâmetros: minSupport = 0.01, minConfidence = 0.5
```

**Casos de Uso**
- Produtos frequentemente comprados juntos
- Sugestões de cross-selling
- Otimização de layout da loja
- Promoções combinadas

### 2. Demand Forecasting (Séries Temporais)

**Métodos Implementados**
- Moving Average (7, 14, 30 dias)
- Exponential Smoothing
- Seasonal Decomposition
- Linear Regression com features sazonais

**Features para Previsão**
- Vendas históricas do produto
- Sazonalidade (dia da semana, mês, feriados)
- Promoções anteriores
- Tendências de categoria
- Fatores externos (clima, eventos locais)

### 3. Product Clustering

**Algoritmo K-Means**
- Agrupamento por similaridade de vendas
- Features: preço, categoria, sazonalidade, margem
- Identificação de produtos substitutos
- Estratégias diferenciadas por cluster

### 4. Anomaly Detection

**Statistical Methods**
- Z-Score para identificar vendas anômalas
- Isolation Forest para detecção de outliers
- Control Charts para monitoramento de tendências

**Aplicações**
- Produtos com queda abrupta nas vendas
- Picos de vendas inexplicáveis
- Possíveis erros de preço
- Fraudes ou problemas operacionais

### 5. Price Elasticity Analysis

**Cálculo da Elasticidade**
```
Elasticidade = (% Mudança na Quantidade) / (% Mudança no Preço)
```

**Insights Gerados**
- Produtos sensíveis vs insensíveis a preço
- Ponto ótimo de precificação
- Impacto de promoções na receita total
- Estratégias de markup por categoria

---

## REGRAS DE NEGÓCIO ESPECÍFICAS

### 1. Geração Automática de Alertas

**Estoque Baixo** (LOW_STOCK)
- Trigger: Vendas últimos 7 dias > Estoque atual / Tempo médio de reposição
- Prioridade: MEDIUM (se <7 dias), HIGH (se <3 dias)

**Produto Encalhado** (SLOW_MOVING)
- Trigger: Zero vendas nos últimos 30 dias + Estoque > 0
- Prioridade: MEDIUM (se custo baixo), HIGH (se perecível)

**Oportunidade Promocional** (PROMOTION_OPPORTUNITY)
- Trigger: Produto com alta elasticidade + Vendas abaixo da média sazonal
- Prioridade: LOW (sugestão), MEDIUM (se produto sazonal)

**Risco de Vencimento** (EXPIRATION_RISK)
- Trigger: Data de vencimento em <15 dias + Estoque atual > Venda média diária
- Prioridade: URGENT (perecíveis), HIGH (demais)

**Alto Desempenho** (HIGH_PERFORMING)
- Trigger: Crescimento >50% vs período anterior
- Prioridade: LOW (informativo)

### 2. Cálculos de Performance

**Giro de Estoque**
```
Giro = Custo dos Produtos Vendidos / Estoque Médio
```

**Margem de Contribuição**
```
Margem = (Preço de Venda - Custo) / Preço de Venda * 100
```

**ABC Analysis**
- Classe A: 80% da receita (top 20% produtos)
- Classe B: 15% da receita (próximos 30% produtos)  
- Classe C: 5% da receita (restantes 50% produtos)

### 3. Algoritmo de Recomendação de Compras

**Fórmula Base**
```
Quantidade Sugerida = (Venda Média Diária * Lead Time * Fator Sazonal) + Estoque Segurança
```

**Fatores Considerados**
- Histórico de vendas (peso 40%)
- Tendência recente (peso 25%)
- Sazonalidade (peso 20%)
- Promoções planejadas (peso 10%)
- Eventos especiais (peso 5%)

---

## ESTRUTURA DE DADOS PARA ANALYTICS

### 1. Agregações Pré-Calculadas

**Daily Sales Summary**
```sql
CREATE TABLE daily_sales_summary (
    date DATE,
    market_id UUID,
    product_id UUID,
    quantity_sold DECIMAL,
    revenue DECIMAL,
    transaction_count INTEGER,
    avg_price DECIMAL,
    INDEX (date, market_id, product_id)
);
```

**Weekly Market Basket**
```sql
CREATE TABLE weekly_market_basket (
    week_start DATE,
    market_id UUID,
    product1_id UUID,
    product2_id UUID,
    co_occurrence_count INTEGER,
    support DECIMAL,
    confidence DECIMAL,
    lift DECIMAL,
    INDEX (week_start, market_id)
);
```

### 2. Performance Metrics

**Product Performance Score**
- Giro de estoque (0-40 pontos)
- Margem de contribuição (0-30 pontos)
- Crescimento de vendas (0-20 pontos)
- Frequência de compra (0-10 pontos)

**Market Health Score**
- Diversidade de produtos (0-25 pontos)
- Eficiência de estoque (0-25 pontos)
- Crescimento de receita (0-25 pontos)
- Customer retention (0-25 pontos)

---

## DEPLOYMENT E INFRAESTRUTURA

### 1. Docker Compose Completo

**Services Necessários**
- nginx (reverse proxy + SSL)
- node-api (aplicação principal)
- redis (cache + sessions)
- cron-jobs (analytics + ML)
- monitoring (Prometheus + Grafana - opcional)

### 2. Environment Variables

**Aplicação Desktop**
```ini
API_BASE_URL=https://api.pdv2cloud.com
API_TOKEN=encrypted_token
MONITOR_FOLDERS=C:\PDV\XMLs;D:\Backup\NFe
RETRY_ATTEMPTS=5
LOG_LEVEL=INFO
```

**Backend API**
```ini
NODE_ENV=production
DATABASE_URL=file:./data/pdv2cloud.db
JWT_SECRET=secure_secret_key
REDIS_URL=redis://redis:6379
CORS_ORIGIN=https://app.pdv2cloud.com
```

### 3. SSL/TLS Configuration

**nginx SSL Setup**
- Let's Encrypt certificates
- HTTP → HTTPS redirect
- HSTS headers
- Modern TLS configuration

### 4. Backup Strategy

**Database Backup**
- Daily full backup of SQLite
- Incremental backups every 4 hours
- 30 days retention policy
- Cloud storage replication (AWS S3/Google Cloud)

**Application Backup**
- Code repository (Git)
- Container images
- Configuration files
- SSL certificates

---

## MÉTRICAS DE SUCESSO E MONITORAMENTO

### 1. KPIs Técnicos

**Performance**
- API response time < 200ms (p95)
- XML processing time < 30 segundos
- Dashboard load time < 3 segundos
- System uptime > 99.5%

**Reliability**
- Error rate < 1%
- Data processing success rate > 99%
- Alert generation accuracy > 95%
- Zero data loss incidents

### 2. KPIs de Negócio

**Adoção**
- Usuários ativos diários
- XMLs processados por dia
- Dashboards visualizados
- Alertas atendidos

**Impacto**
- Redução de perdas por vencimento
- Aumento em vendas de produtos recomendados
- Melhoria no giro de estoque
- Satisfação do cliente (NPS)

### 3. Alertas e Monitoramento

**System Health**
- CPU/Memory usage > 80%
- Disk space < 10% free
- Database connections > 80% pool
- Queue size > 1000 items

**Business Metrics**
- Processing delay > 5 minutes
- Error rate spike (>5% em 1 hora)
- Zero data received em 2 horas
- Critical alerts not acknowledged em 24h

---

## CRONOGRAMA DE IMPLEMENTAÇÃO SUGERIDO

### Fase 1: MVP (Semanas 1-8)
- **Semanas 1-2**: Setup do projeto, estrutura base
- **Semanas 3-4**: Aplicação desktop (parser + file watcher)
- **Semanas 5-6**: API backend (ingestão + auth)
- **Semanas 7-8**: Dashboard básico + deploy

### Fase 2: Analytics (Semanas 9-16)
- **Semanas 9-10**: Jobs de agregação diária
- **Semanas 11-12**: Market basket analysis
- **Semanas 13-14**: Sistema de alertas
- **Semanas 15-16**: Portal para indústrias (básico)

### Fase 3: IA e Otimização (Semanas 17-24)
- **Semanas 17-18**: Previsão de demanda
- **Semanas 19-20**: Recomendações personalizadas
- **Semanas 21-22**: Otimizações de performance
- **Semanas 23-24**: Testes de carga + produção

### Fase 4: Escala e Evolução (Semanas 25+)
- Marketplace de campanhas
- Integração com ERPs
- Mobile app
- Machine Learning avançado

---

**RESULTADO ESPERADO**: Uma plataforma completa e funcional que demonstre ROI claro para supermercados através de insights acionáveis e reduza custos de marketing para indústrias através de dados precisos do ponto de venda.