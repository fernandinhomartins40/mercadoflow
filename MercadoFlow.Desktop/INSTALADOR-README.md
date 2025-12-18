# 📦 Instalador MercadoFlow Desktop v1.0.0

## ✅ Instalador Criado com Sucesso!

**Arquivo**: `MercadoFlow-Desktop-Instalador.zip` (72 MB)

---

## 🚀 Como Instalar

### Passo a Passo:

1. **Extraia o arquivo ZIP**
   - Clique com botão direito em `MercadoFlow-Desktop-Instalador.zip`
   - Selecione "Extrair tudo..." ou "Extract here"

2. **Execute o instalador como Administrador**
   - Navegue até a pasta extraída
   - Clique com botão direito em `INSTALAR.bat`
   - Selecione **"Executar como administrador"**

3. **Aguarde a instalação**
   - O instalador irá:
     - Copiar arquivos para `C:\Program Files\MercadoFlow`
     - Criar pastas de dados (Data, Logs, Uploads)
     - Configurar permissões
     - Criar atalhos (Área de Trabalho e Menu Iniciar)
     - Registrar no Painel de Controle do Windows

4. **Execute a aplicação**
   - Ao final, você pode optar por executar imediatamente
   - Ou use o atalho na Área de Trabalho: **MercadoFlow Desktop**

---

## 📋 Requisitos do Sistema

- **Sistema Operacional**: Windows 10 ou Windows 11 (64-bit)
- **Privilégios**: Administrador (necessário para instalação)
- **Espaço em Disco**: Mínimo 150 MB
- **Memória RAM**: Mínimo 512 MB

---

## 📁 Localização Após Instalação

```
C:\Program Files\MercadoFlow\
├── MercadoFlow.Desktop.exe (aplicação principal)
├── Data\                    (banco de dados local)
├── Logs\                    (arquivos de log)
├── Uploads\                 (arquivos processados)
└── Desinstalar.bat          (desinstalador)
```

---

## 🎯 Como Usar

### Primeira Configuração:

1. **Abra a aplicação** usando o atalho
2. **Configure o servidor**:
   - URL da API: `http://seu-servidor:3000/api`
   - Ou use `http://localhost:3000/api` para testes locais
3. **Adicione pastas para monitoramento**:
   - Clique em "Configurações"
   - Adicione as pastas onde os arquivos XML serão salvos
   - Exemplo: `C:\NFe\`, `C:\SAT\`, etc.

### Funcionamento Automático:

- A aplicação monitora as pastas configuradas em tempo real
- Quando um arquivo XML é detectado:
  1. Valida o formato
  2. Extrai os dados da nota fiscal
  3. Envia para o servidor web
  4. Move o arquivo para a pasta de processados
- Tudo acontece automaticamente!

---

## 🗑️ Como Desinstalar

### Opção 1 - Pelo Instalador:
1. Navegue até `C:\Program Files\MercadoFlow\`
2. Clique com botão direito em `Desinstalar.bat`
3. Selecione "Executar como administrador"

### Opção 2 - Pelo Windows:
1. Abra "Configurações" → "Aplicativos"
2. Procure por "MercadoFlow Desktop"
3. Clique em "Desinstalar"

### Opção 3 - Painel de Controle:
1. Painel de Controle → Programas → Desinstalar um programa
2. Selecione "MercadoFlow Desktop"
3. Clique em "Desinstalar"

---

## 🔧 Atualização Futura

Para criar um instalador EXE profissional (opcional):

1. **Instale o Inno Setup**:
   - Download: https://jrsoftware.org/isdl.php
   - Instale a versão mais recente

2. **Execute o script novamente**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File build-inno-installer.ps1
   ```

3. **Resultado**: Instalador EXE profissional com interface gráfica moderna

---

## 📞 Suporte

- **Email**: suporte@mercadoflow.com
- **Website**: https://mercadoflow.com

---

## 📄 Licença

Copyright © 2024 MercadoFlow. Todos os direitos reservados.

Este software é proprietário. Consulte LICENSE.txt para detalhes.
