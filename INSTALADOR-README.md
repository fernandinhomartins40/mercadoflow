# 📦 MercadoFlow - Status do Instalador

## ✅ Sistema Web - **RODANDO PERFEITAMENTE**

### 🌐 Backend API
- **Status**: ✅ Funcionando
- **URL**: http://localhost:3000
- **Endpoints**: Totalmente operacionais
- **Banco de Dados**: SQLite configurado e populado

### 💻 Frontend React
- **Status**: ✅ Funcionando
- **URL**: http://localhost:3001
- **Interface**: Totalmente funcional

### 🔐 Credenciais de Teste
```
Admin: admin@mercadoflow.com / Admin@123
Market Owner: dono@supermercadoabc.com / Admin@123
Industry: contato@industriaxyz.com / Admin@123
```

---

## ⚠️ Sistema Desktop - **REQUER CORREÇÕES**

### Status Atual
A aplicação Desktop (.NET 8 + WPF) possui **15 erros de compilação** que precisam ser corrigidos antes de criar o instalador.

### Erros Principais
1. **Falta `using Microsoft.Extensions.Http`** em Program.cs
2. **Falta `using MercadoFlow.Desktop.Parsers`** em Program.cs
3. **Ambiguidade `Environment`** (conflito entre System.Environment e Models.Environment)
4. **Ambiguidade `LogLevel`** (conflito entre Microsoft.Extensions.Logging e Models.LogLevel)
5. **Falta `using Microsoft.EntityFrameworkCore`** em HealthCheckService.cs
6. **Conversão de tipo** em ApiService.cs (ByteArrayContent para StringContent)
7. **ViewModel**: Incompatibilidade de tipos entre MonitoringStatistics e ProcessingStatistics

---

## 📋 Como Corrigir e Criar o Instalador

### Opção 1: Corrigir Erros Manualmente

#### 1. Adicionar using em Program.cs
```csharp
using MercadoFlow.Desktop.Parsers;
```

#### 2. Adicionar pacote HttpClient ao .csproj
```xml
<PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />
```

#### 3. Corrigir ambiguidades
Substituir todas as ocorrências de:
- `Environment.` → `System.Environment.`
- `LogLevel.Error` → `Models.LogLevel.Error`

#### 4. Adicionar using EntityFrameworkCore em HealthCheckService.cs
```csharp
using Microsoft.EntityFrameworkCore;
```

#### 5. Compilar
```powershell
cd MercadoFlow.Desktop
dotnet build src\MercadoFlow.Desktop.csproj -c Release
```

#### 6. Criar Instalador
```powershell
.\build-installer.ps1
```

---

### Opção 2: Usar Aplicação Web (Recomendado Agora)

Como a **aplicação Web está totalmente funcional**, você pode:

1. **Usar apenas o sistema Web** por enquanto
2. Acessar http://localhost:3001
3. Fazer login com as credenciais de teste
4. Explorar todas as funcionalidades de analytics

A aplicação Desktop serve apenas para **coletar XMLs automaticamente** dos PDVs e enviar para a API. Você pode testar a API manualmente enviando XMLs via Postman/curl enquanto corrige os erros.

---

## 📁 Arquivos Criados para o Instalador

### Scripts Disponíveis
- `build-installer.ps1` - Script completo para criar instalador ZIP
- `simple-build.ps1` - Build simplificado
- `fix-errors.ps1` - Script auxiliar de correção

### Configuração WiX (Opcional)
- `installer/Product.wxs` - Configuração para criar MSI com WiX Toolset

---

## 🔄 Fluxo Completo do Sistema Desktop

### Como Funciona
1. **Instalação**: Usuário instala via `install.bat` (como administrador)
2. **Configuração Inicial**:
   - URL da API: `http://localhost:3000`
   - Market ID e credenciais
   - Pastas para monitorar (ex: `C:\PDV\XMLs`)
3. **Monitoramento Automático**:
   - Sistema detecta novos XMLs nas pastas configuradas
   - Processa e valida cada XML
   - Envia automaticamente para a API
4. **Pós-Processamento**:
   - Move XMLs processados para pasta `Processados`
   - Mantém fila local em caso de falha
   - Retry automático

### O que NÃO Faz
- ❌ Não busca em todo o computador
- ❌ Não processa XMLs antigos automaticamente (opcional na configuração)
- ❌ Não deleta arquivos (apenas move)

---

## 🎯 Próximos Passos

### Para Teste Imediato (Recomendado)
1. Usar aplicação Web rodando
2. Testar APIs via Postman
3. Enviar XMLs manualmente para: `POST http://localhost:3000/api/v1/ingest/invoice`

### Para Instalador Desktop
1. Corrigir 15 erros de compilação listados acima
2. Executar `simple-build.ps1` para verificar compilação
3. Executar `build-installer.ps1` para criar instalador completo
4. Distribuir o ZIP gerado: `MercadoFlow-Desktop-Installer-v1.0.0.zip`

---

## 📊 Estrutura do Instalador (Quando Pronto)

```
MercadoFlow-Desktop-Installer-v1.0.0.zip
├── install.bat           # Instalador (executar como Admin)
├── LEIA-ME.txt          # Instruções
└── files/
    ├── MercadoFlow.Desktop.exe
    ├── appsettings.json
    ├── NLog.config
    ├── uninstall.bat
    └── [DLLs e dependências]
```

### Local de Instalação
```
C:\Program Files\MercadoFlow\
├── MercadoFlow.Desktop.exe
├── Data\               # Banco SQLite local
├── Logs\              # Logs da aplicação
└── Uploads\           # Cache de XMLs
```

### Atalhos Criados
- Área de Trabalho: `MercadoFlow Desktop.lnk`
- Menu Iniciar: `MercadoFlow Desktop.lnk`

---

## 🛠️ Requisitos do Desktop

- Windows 10/11 (64-bit)
- .NET 8 Runtime (incluído no instalador)
- 500MB espaço em disco
- Permissões de administrador para instalação

---

## ✨ Resumo

| Componente | Status | Ação |
|------------|--------|------|
| **Web Backend** | ✅ Rodando | Usar normalmente |
| **Web Frontend** | ✅ Rodando | Acessar http://localhost:3001 |
| **Desktop App** | ⚠️ Erros | Corrigir 15 erros de compilação |
| **Instalador** | 📝 Pronto | Executar após corrigir compilação |

---

**Data**: 2024-12-09
**Versão**: 1.0.0
**Status Geral**: Sistema Web operacional, Desktop requer correções
