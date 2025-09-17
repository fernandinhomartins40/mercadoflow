# MercadoFlow Desktop Collector

Uma aplicação desktop robusta para coleta e transmissão de dados de vendas de supermercados, desenvolvida com .NET 8 e WPF.

## 📋 Visão Geral

O MercadoFlow Desktop Collector é um agente de coleta que monitora automaticamente pastas em busca de arquivos XML de NF-e/NFC-e, processa esses dados e os envia de forma segura para a plataforma na nuvem. É a parte desktop da solução completa MercadoFlow Intelligence.

## ✨ Funcionalidades Principais

### 🔍 Monitoramento de Arquivos
- **FileSystemWatcher avançado** com debounce e controle de concorrência
- Monitora múltiplas pastas configuráveis
- Suporte a arquivos XML e ZIP compactados
- Detecção de duplicatas e validação de integridade
- Processamento de subpastas opcional

### 📊 Parser de XML
- **Suporte completo a NFe e NFCe** (versões 3.10 e 4.00)
- Extração de dados completos da nota fiscal
- Processamento de itens, pagamentos e impostos
- Validação de schema e assinatura digital
- Normalização e sanitização de dados

### 🔐 Segurança e Criptografia
- **Criptografia DPAPI** para dados sensíveis
- Validação de certificados SSL/TLS
- Armazenamento seguro de credenciais
- Hash SHA-256 para integridade de arquivos
- Configurações criptografadas

### 📡 Transmissão Confiável
- **Padrão Outbox** com SQLite local
- Retry automático com backoff exponencial
- Compressão GZIP para arquivos grandes
- Health check automático da API
- Dead letter queue para falhas críticas

### 🎨 Interface Moderna
- **Dashboard em tempo real** com métricas
- Configurações avançadas por categoria
- Visualizador de logs integrado
- Alertas visuais e notificações
- Design responsivo e tema customizável

## 🏗️ Arquitetura

### Estrutura do Projeto
```
MercadoFlow.Desktop/
├── src/
│   ├── Configuration/          # Classes de configuração
│   ├── Data/                   # Entity Framework e SQLite
│   ├── Models/                 # Modelos de dados e DTOs
│   ├── Parsers/                # Processamento de XML
│   ├── Services/               # Lógica de negócio
│   ├── ViewModels/             # MVVM ViewModels
│   ├── Views/                  # Interfaces WPF
│   └── Utils/                  # Utilitários
├── tests/                      # Testes unitários
└── docs/                       # Documentação
```

### Tecnologias Utilizadas
- **.NET 8** - Framework principal
- **WPF** - Interface gráfica
- **Entity Framework Core** - ORM para SQLite
- **NLog** - Sistema de logging
- **Polly** - Resiliência e retry
- **AutoUpdater.NET** - Sistema de atualizações

## 🚀 Instalação e Configuração

### Pré-requisitos
- Windows 10/11 (x64)
- .NET 8 Runtime
- 500MB de espaço em disco
- Conexão com internet

### Instalação
1. Baixe o instalador MSI mais recente
2. Execute como administrador
3. Siga o assistente de instalação
4. Configure as pastas de monitoramento

### Configuração Inicial
1. **API**: Configure a URL base e credenciais
2. **Pastas**: Adicione diretórios para monitoramento
3. **Segurança**: Valide configurações de SSL
4. **Performance**: Ajuste concorrência conforme necessário

## 📖 Guia de Uso

### Dashboard Principal
- **Status dos Serviços**: Monitoramento e conectividade
- **Métricas em Tempo Real**: Arquivos processados, fila, taxa de sucesso
- **Fila de Processamento**: Visualização de itens pendentes
- **Alertas**: Notificações sobre erros e problemas

### Configurações

#### Monitoramento
- **Pastas Monitoradas**: Diretórios para busca de XMLs
- **Debounce**: Tempo de espera antes do processamento
- **Tamanho Máximo**: Limite de tamanho de arquivo
- **Pós-processamento**: Mover ou deletar arquivos

#### API
- **URL Base**: Endpoint da API MercadoFlow
- **Autenticação**: API Key e Market ID
- **Timeout**: Tempo limite para requisições
- **Retry**: Configuração de tentativas

#### Segurança
- **Certificados**: Validação SSL/TLS
- **Criptografia**: Proteção de dados locais
- **XML**: Validação de schema e assinatura

### Logs e Diagnósticos
- **Visualizador Integrado**: Interface para consulta de logs
- **Filtros Avançados**: Por nível, fonte e conteúdo
- **Export**: Exportação para CSV/TXT
- **Rotação Automática**: Limpeza de logs antigos

## 🔧 Configuração Avançada

### Arquivo de Configuração
```json
{
  "MonitoringSettings": {
    "WatchedFolders": ["C:\\PDV\\XMLs"],
    "DebounceDelayMs": 2000,
    "MaxFileSizeMB": 50,
    "ProcessSubfolders": true
  },
  "ApiSettings": {
    "BaseUrl": "https://api.mercadoflow.com",
    "RetryAttempts": 5,
    "EnableCompression": true
  }
}
```

### Variáveis de Ambiente
```bash
MERCADOFLOW_API_URL=https://api.mercadoflow.com
MERCADOFLOW_MARKET_ID=your_market_id
MERCADOFLOW_LOG_LEVEL=Information
```

### Linha de Comando
```bash
MercadoFlow.Desktop.exe --config-file "custom.json" --log-level Debug
```

## 📊 Monitoramento e Métricas

### KPIs Principais
- **Taxa de Sucesso**: % de XMLs processados com sucesso
- **Tempo Médio**: Latência de processamento
- **Fila**: Tamanho atual da fila de envio
- **Erros**: Contagem de falhas por período

### Health Checks
- **Serviços**: Status do monitoramento de arquivos
- **API**: Conectividade com a plataforma
- **Banco**: Saúde do SQLite local
- **Sistema**: CPU, memória e disco

### Alertas Automáticos
- **Alto Número de Erros**: > 10 falhas em 1 hora
- **Fila Grande**: > 1000 itens pendentes
- **Conectividade**: Perda de conexão com API
- **Recursos**: Uso excessivo de CPU/memória

## 🛠️ Solução de Problemas

### Problemas Comuns

#### "Arquivo não encontrado"
- Verifique se a pasta existe e tem permissões
- Confirme que não há caracteres especiais no caminho
- Teste com uma pasta diferente

#### "Erro de conectividade"
- Verifique conexão com internet
- Confirme URL da API
- Teste firewall e proxy

#### "XML inválido"
- Verifique integridade do arquivo
- Confirme versão suportada (3.10 ou 4.00)
- Teste validação de schema

### Logs Detalhados
```bash
# Habilitar debug completo
LogLevel: Debug

# Logs estruturados em JSON
logs/mercadoflow-structured-YYYY-MM-DD.json
```

### Reset de Configuração
1. Pare o serviço
2. Delete `%APPDATA%/MercadoFlow/config.json`
3. Reinicie a aplicação
4. Reconfigure as opções

## 🔄 Atualizações

### Automáticas
- Verificação diária de novas versões
- Download automático em background
- Instalação com confirmação do usuário
- Rollback automático em caso de falha

### Manuais
1. Acesse Configurações > Atualizações
2. Clique em "Verificar Atualizações"
3. Baixe e instale a versão mais recente
4. Reinicie a aplicação

## 📈 Performance

### Otimizações
- **Processamento Paralelo**: Até 5 arquivos simultâneos
- **Cache Inteligente**: Detecção de duplicatas
- **Compressão**: Redução de 60% no tráfego
- **Batch Processing**: Envio em lotes para eficiência

### Benchmarks
- **Processamento**: 1000+ XMLs/hora por PDV
- **Latência**: < 200ms para XMLs típicos
- **Memória**: < 100MB em uso normal
- **CPU**: < 10% em processamento ativo

## 🔒 Segurança

### Criptografia
- **DPAPI**: Proteção baseada no usuário Windows
- **AES-256**: Criptografia adicional para dados críticos
- **SHA-256**: Hashing para integridade
- **TLS 1.2+**: Comunicação segura com API

### Compliance
- **LGPD**: Proteção de dados pessoais
- **NFe**: Validação completa de schemas
- **Auditoria**: Log de todas as operações
- **Backup**: Cópias de segurança automáticas

## 👥 Suporte

### Documentação
- **Wiki**: https://docs.mercadoflow.com
- **API Reference**: https://api.mercadoflow.com/docs
- **Tutoriais**: Vídeos e guias passo-a-passo

### Contato
- **Email**: suporte@mercadoflow.com
- **Telefone**: (11) 1234-5678
- **Chat**: Disponível 24/7 no dashboard

## 📄 Licença

Copyright © 2024 MercadoFlow. Todos os direitos reservados.

Este software é proprietário e seu uso está sujeito aos termos do contrato de licença.

---

**Versão**: 1.0.0
**Última Atualização**: Janeiro 2024
**Compatibilidade**: Windows 10/11, .NET 8+