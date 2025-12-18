# 🚀 Guia de Deploy - MercadoFlow Web

Este documento contém todas as instruções para realizar o deploy do MercadoFlow Web na sua VPS usando Docker, GitHub Actions e Nginx.

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Arquitetura da Aplicação](#arquitetura-da-aplicação)
- [Configuração Inicial](#configuração-inicial)
- [Deploy Manual](#deploy-manual)
- [Deploy Automático (CI/CD)](#deploy-automático-cicd)
- [Configuração SSL/HTTPS](#configuração-sslhttps)
- [Backup e Restauração](#backup-e-restauração)
- [Monitoramento](#monitoramento)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Pré-requisitos

### Na VPS (Ubuntu/Debian):

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Instalar Nginx
sudo apt install nginx -y

# Instalar Certbot (para SSL)
sudo apt install certbot python3-certbot-nginx -y

# Verificar instalações
docker --version
docker compose version
nginx -v
certbot --version
```

### No Repositório GitHub:

1. Configurar Secret `VPS_PASSWORD` em Settings → Secrets → Actions
2. Adicionar a senha SSH da VPS root

---

## 🏗️ Arquitetura da Aplicação

```
┌─────────────────────────────────────────────┐
│          Internet (porta 443/80)            │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│     Nginx do Sistema (Reverse Proxy)       │
│     - SSL/TLS Termination                   │
│     - Rate Limiting (opcional)              │
└────────────────┬────────────────────────────┘
                 │
                 ▼ porta 3300
┌─────────────────────────────────────────────┐
│        Docker Container: Nginx              │
│        - Roteamento interno                 │
└────────┬───────────────────────────┬────────┘
         │                           │
         ▼ porta 3001                ▼ porta 3000
┌────────────────┐          ┌──────────────────┐
│    Backend     │          │     Frontend     │
│   (Node.js)    │◄─────────│     (React)      │
│   + Prisma     │          │   + Vite + Nginx │
└───────┬────────┘          └──────────────────┘
        │
        │
        ▼
┌────────────────┐
│     SQLite     │
│   (Volume)     │
└────────────────┘
        │
        ▼
┌────────────────┐          ┌──────────────────┐
│     Redis      │          │   Cron Jobs      │
│   (Cache)      │          │  (Analytics)     │
└────────────────┘          └──────────────────┘
```

### Portas:

- **Externa (Pública):** 443 (HTTPS), 80 (HTTP → redirect 443)
- **Interna Docker:** 3300 (Nginx container)
- **Backend API:** 3001 (interno)
- **Frontend:** 3000 (interno)
- **Redis:** 6379 (interno)

### Volumes Persistentes:

- `mercadoflow_backend_data` - Banco de dados SQLite
- `mercadoflow_redis_data` - Cache Redis
- `mercadoflow_backend_uploads` - Uploads de arquivos
- `mercadoflow_backend_logs` - Logs da aplicação

---

## ⚙️ Configuração Inicial

### 1. Clonar repositório na VPS:

```bash
cd /root
mkdir -p mercadoflow-web
cd mercadoflow-web
```

### 2. Criar arquivo `.env`:

```bash
# Gerar JWT Secret seguro
openssl rand -hex 32 > .jwt_secret
JWT_SECRET=$(cat .jwt_secret)

# Criar arquivo .env
cat > .env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000
NGINX_PORT=3300

DATABASE_URL=file:/app/data/mercadoflow.db
REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

REACT_APP_API_BASE_URL=https://mercadoflow.com/api
REACT_APP_ENVIRONMENT=production

CORS_ORIGIN=https://mercadoflow.com,https://www.mercadoflow.com

CONTAINER_MEMORY_LIMIT=2g
CONTAINER_CPU_LIMIT=2

BUILD_TIMESTAMP=$(date +%s)
EOF
```

### 3. Configurar permissões dos scripts:

```bash
chmod +x scripts/*.sh
```

---

## 🚀 Deploy Manual

### Passo 1: Build das imagens

```bash
cd /root/mercadoflow-web
export BUILD_TIMESTAMP=$(date +%s)
docker-compose -f docker-compose.vps.yml build --no-cache
```

### Passo 2: Iniciar containers

```bash
docker-compose -f docker-compose.vps.yml up -d
```

### Passo 3: Verificar logs

```bash
# Ver todos os logs
docker-compose -f docker-compose.vps.yml logs -f

# Ver log específico
docker logs mercadoflow-backend -f
docker logs mercadoflow-frontend -f
docker logs mercadoflow-nginx -f
```

### Passo 4: Verificar status

```bash
# Status dos containers
docker-compose -f docker-compose.vps.yml ps

# Health check
curl http://localhost:3300/health
curl http://localhost:3300/api/v1/health
```

---

## 🤖 Deploy Automático (CI/CD)

### GitHub Actions

O deploy automático é acionado quando:

1. **Push na branch `main`** com alterações em `MercadoFlow.Web/**`
2. **Manualmente** via workflow dispatch

### Workflow:

`.github/workflows/deploy-mercadoflow-web.yml`

### Processo automatizado:

1. ✅ Sincroniza código via rsync
2. ✅ Cria backups de segurança
3. ✅ Para containers (preservando volumes)
4. ✅ Build de novas imagens
5. ✅ Inicia novos containers
6. ✅ Executa migrations (Prisma)
7. ✅ Verifica health checks
8. ✅ Configura Nginx
9. ✅ Notifica resultado

### Monitorar deploy:

```bash
# Na VPS, acompanhar em tempo real
tail -f /var/log/mercadoflow/deploy.log
```

---

## 🔒 Configuração SSL/HTTPS

### Usando Certbot (Let's Encrypt):

```bash
# Obter certificado SSL gratuito
sudo certbot --nginx \
  -d mercadoflow.com \
  -d www.mercadoflow.com \
  --non-interactive \
  --agree-tos \
  --email seu-email@exemplo.com
```

### Renovação automática:

```bash
# Testar renovação
sudo certbot renew --dry-run

# Certbot adiciona automaticamente um cron job para renovação
# Verificar: sudo systemctl status certbot.timer
```

### Verificar SSL:

```bash
# Testar certificado
curl -I https://mercadoflow.com
openssl s_client -connect mercadoflow.com:443 -servername mercadoflow.com
```

---

## 💾 Backup e Restauração

### Backup Manual:

```bash
cd /root/mercadoflow-web
./scripts/backup.sh backup_nome_opcional
```

O backup será salvo em `/root/mercadoflow-web/backups/`

### Backup Automático:

Backups são criados automaticamente:
- ✅ Antes de cada deploy (via GitHub Actions)
- ✅ Mantém últimos 7 backups

### Restaurar Backup:

```bash
cd /root/mercadoflow-web
./scripts/restore.sh backups/backup_20250101_120000.db.gz
```

### Listar Backups:

```bash
ls -lh /root/mercadoflow-web/backups/
```

### Backup Remoto (Opcional):

Configure variáveis no `.env` para backup em S3:

```bash
AWS_S3_BUCKET=seu-bucket
AWS_ACCESS_KEY_ID=sua-chave
AWS_SECRET_ACCESS_KEY=sua-secret
AWS_REGION=us-east-1
```

---

## 📊 Monitoramento

### Verificar containers:

```bash
# Status de todos os containers
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml ps

# Uso de recursos
docker stats
```

### Logs:

```bash
# Backend
docker logs mercadoflow-backend --tail=100 -f

# Frontend
docker logs mercadoflow-frontend --tail=50

# Nginx
docker logs mercadoflow-nginx --tail=50

# Cron Jobs
docker logs mercadoflow-cron --tail=50

# Todos
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml logs -f
```

### Health Checks:

```bash
# Health da aplicação
curl http://localhost:3300/health

# Health do backend
curl http://localhost:3300/api/v1/health

# Verificar Redis
docker exec mercadoflow-redis redis-cli ping
```

### Estatísticas do Banco:

```bash
docker exec mercadoflow-backend sqlite3 /app/data/mercadoflow.db "
SELECT
  'Usuários' as tabela, COUNT(*) as registros FROM users
UNION ALL
SELECT 'Mercados', COUNT(*) FROM markets
UNION ALL
SELECT 'Notas Fiscais', COUNT(*) FROM invoices
UNION ALL
SELECT 'Produtos', COUNT(*) FROM products;
"
```

### Espaço em disco:

```bash
# Volumes Docker
docker system df -v

# Disco do sistema
df -h
du -sh /var/lib/docker/volumes/mercadoflow_*
```

---

## 🔧 Troubleshooting

### Container não inicia:

```bash
# Ver logs detalhados
docker logs mercadoflow-backend --tail=200

# Inspecionar container
docker inspect mercadoflow-backend

# Verificar se porta está ocupada
netstat -tulpn | grep 3300
```

### Erro de permissão no banco:

```bash
# Ajustar permissões do volume
docker exec mercadoflow-backend chown -R mercadoflow:nodejs /app/data
docker exec mercadoflow-backend chmod -R 755 /app/data
```

### Prisma não gerou cliente:

```bash
# Regenerar Prisma Client
docker exec mercadoflow-backend npx prisma generate --schema=./prisma/schema.prisma

# Executar migrations
docker exec mercadoflow-backend npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Redis não conecta:

```bash
# Verificar se Redis está rodando
docker exec mercadoflow-redis redis-cli ping

# Restartar Redis
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml restart redis
```

### Nginx retorna 502 Bad Gateway:

```bash
# Verificar se backend está respondendo
curl http://localhost:3001/api/v1/health

# Verificar configuração do Nginx
docker exec mercadoflow-nginx nginx -t

# Reiniciar Nginx
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml restart nginx
```

### Limpar containers e reconstruir:

```bash
cd /root/mercadoflow-web

# Parar todos os containers (preservando volumes!)
docker-compose -f docker-compose.vps.yml down

# Remover imagens antigas
docker image prune -af

# Rebuild completo
export BUILD_TIMESTAMP=$(date +%s)
docker-compose -f docker-compose.vps.yml build --no-cache
docker-compose -f docker-compose.vps.yml up -d
```

### Resetar volumes (⚠️ APAGA DADOS!):

```bash
# ⚠️ AVISO: Isso irá apagar TODOS os dados!
# Fazer backup primeiro!
cd /root/mercadoflow-web
./scripts/backup.sh backup_antes_reset

# Parar containers e remover volumes
docker-compose -f docker-compose.vps.yml down -v

# Reiniciar do zero
docker-compose -f docker-compose.vps.yml up -d
```

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Verificar logs: `docker-compose logs -f`
2. Consultar esta documentação
3. Verificar issues no GitHub
4. Contatar equipe de suporte

---

## 📝 Checklist Pós-Deploy

- [ ] Aplicação responde em `https://mercadoflow.com`
- [ ] SSL/HTTPS configurado e funcionando
- [ ] Health checks passando
- [ ] Backup automático funcionando
- [ ] Logs sendo gerados corretamente
- [ ] Cron jobs executando (verificar logs)
- [ ] Monitoramento configurado (opcional)
- [ ] Usuário admin criado e testado
- [ ] Documentação atualizada

---

**MercadoFlow Web v1.0** | Deploy em VPS com Docker 🚀
