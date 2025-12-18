# 🐛 Como Debugar o Problema dos Botões

## Novo Instalador COM LOGGING DETALHADO

**Arquivo**: `MercadoFlow-Desktop-Instalador.zip` (71,25 MB)

Adicionei logging extensivo em todo o código para identificar exatamente onde está falhando.

---

## Passos para Instalar e Debugar

### 1. Desinstalar Versão Antiga
```powershell
# Execute como Administrador
C:\Program Files\MercadoFlow\Desinstalar.bat
```

### 2. Instalar Nova Versão
1. Extraia `MercadoFlow-Desktop-Instalador.zip`
2. Clique com botão direito em `INSTALAR.bat`
3. Selecione "Executar como administrador"

### 3. Executar a Aplicação
```powershell
C:\Program Files\MercadoFlow\MercadoFlow.Desktop.exe
```

### 4. Tentar Clicar nos Botões
- Clique em **"Testar API"**
- Clique em **"Configurações"**
- Clique em **"Logs"**
- Clique em **"Iniciar"**

### 5. Verificar os Logs
```powershell
# Abrir pasta de logs
cd "C:\Program Files\MercadoFlow\Logs"

# Listar logs
dir *.log

# Ver último log
Get-Content (Get-ChildItem *.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

---

## O que Procurar nos Logs

### ✅ Se os botões funcionarem, você verá:

```log
[INFO] === MainWindowViewModel Constructor ===
[INFO] ServiceProvider: OK
[INFO] Logger: OK
[INFO] Criando comandos...
[INFO] StartCommand criado
[INFO] StopCommand criado
[INFO] TestConnectionCommand criado
[INFO] RefreshCommand criado
[INFO] OpenConfigurationCommand criado
[INFO] OpenLogsCommand criado
[INFO] Criando coleções...
[INFO] Coleções criadas
[INFO] Chamando InitializeAsync...
[INFO] MainWindowViewModel inicializado
```

Quando clicar em um botão:
```log
[INFO] Testando conexão com API...
```

### ❌ Se os botões NÃO funcionarem, procure por:

1. **Erro no Construtor**:
```log
[ERROR] ERRO CRÍTICO no construtor do MainWindowViewModel
```

2. **ServiceProvider NULL**:
```log
[INFO] ServiceProvider: NULL
```

3. **Erro ao criar comandos**:
```log
[ERROR] Erro ao criar StartCommand
```

4. **Nenhum log de clique**: Se você clica e não aparece nada nos logs, significa que o binding não está funcionando

---

## Como Enviar os Logs para Análise

### Opção 1 - Via PowerShell
```powershell
# Copiar último log para área de transferência
Get-Content (Get-ChildItem "C:\Program Files\MercadoFlow\Logs\*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName | clip
```

Depois cole aqui (Ctrl+V)

### Opção 2 - Abrir Arquivo
```powershell
# Abrir com Notepad
notepad (Get-ChildItem "C:\Program Files\MercadoFlow\Logs\*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

Copie o conteúdo completo

---

## Testes Adicionais

### Teste 1: Verificar se aparece erro visual
- Ao abrir a aplicação, aparece alguma mensagem de erro?
- Se sim, tire print e envie

### Teste 2: Verificar evento de clique
1. Abra a aplicação
2. Clique em qualquer botão
3. Veja se o botão "pisca" ou muda de cor
   - **Pisca**: O clique está funcionando, mas o comando não
   - **Não pisca**: O binding do WPF está quebrado

### Teste 3: Verificar DataContext
Execute este comando enquanto a aplicação está aberta:
```powershell
# Verificar se appsettings.json existe
Test-Path "C:\Program Files\MercadoFlow\appsettings.json"
```

Deve retornar `True`. Se retornar `False`, falta o arquivo de configuração.

---

## Correções que Já Foram Aplicadas

1. ✅ Criado `AsyncRelayCommand` para suportar comandos assíncronos
2. ✅ Removido duplicação de `IApiService` no DI
3. ✅ Corrigido scope de serviços (não mais descartados)
4. ✅ Adicionado logging detalhado em todo o ViewModel
5. ✅ Adicionado tratamento de exceções com MessageBox

---

## Se AINDA Não Funcionar

Me envie:

1. **Últimas 50 linhas do log**:
```powershell
Get-Content (Get-ChildItem "C:\Program Files\MercadoFlow\Logs\*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName -Tail 50
```

2. **Confirme se os botões "piscam" quando clica**

3. **Screenshot da aplicação aberta**

Com essas informações, vou identificar exatamente o problema! 🎯
