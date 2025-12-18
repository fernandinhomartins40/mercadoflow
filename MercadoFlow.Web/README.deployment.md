# 🚀 MercadoFlow Web - Quick Deploy Guide

## ⚡ Deploy Rápido

### 1. Configurar VPS (primeira vez apenas)

```bash
# Na VPS como root
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin nginx certbot python3-certbot-nginx -y
```

### 2. Configurar GitHub Secret

- Ir em: Settings → Secrets → Actions
- Adicionar: `VPS_PASSWORD` = senha SSH da VPS

### 3. Push para main

```bash
git add .
git commit -m "deploy: configurar MercadoFlow Web"
git push origin main
```

O deploy acontece automaticamente! ✅

### 4. Configurar SSL (após primeiro deploy)

```bash
# Na VPS
sudo certbot --nginx -d mercadoflow.com -d www.mercadoflow.com
```

---

## 📋 Arquivos Criados

```
MercadoFlow.Web/
├── docker-compose.vps.yml       # Orquestração Docker para VPS
├── .dockerignore                # Ignora arquivos no build
├── .env.example                 # Template de variáveis
├── DEPLOY.md                    # Documentação completa ⭐
│
├── nginx/
│   └── nginx.vps.conf          # Config Nginx interno
│
├── backend/
│   ├── Dockerfile              # Build backend (atualizado)
│   ├── Dockerfile.cron         # Jobs agendados
│   ├── docker-entrypoint.sh    # Script inicialização
│   └── .dockerignore           # Ignora arquivos backend
│
├── frontend/
│   ├── Dockerfile              # Build frontend (atualizado)
│   └── .dockerignore           # Ignora arquivos frontend
│
├── scripts/
│   ├── backup.sh               # Backup manual do banco
│   ├── restore.sh              # Restaurar backup
│   └── notify.sh               # Notificações (Slack/Discord)
│
└── .github/
    └── workflows/
        └── deploy-mercadoflow-web.yml  # CI/CD GitHub Actions
```

---

## 🏗️ Arquitetura

```
Internet (443/80)
    ↓
Nginx Sistema (SSL)
    ↓
Docker Nginx (3300)
    ↓
├── Backend (3001) → SQLite + Redis
└── Frontend (3000)
```

---

## 🔑 Comandos Úteis

### Ver logs:
```bash
cd /root/mercadoflow-web
docker-compose -f docker-compose.vps.yml logs -f
```

### Backup:
```bash
./scripts/backup.sh
```

### Restaurar:
```bash
./scripts/restore.sh backups/latest.db.gz
```

### Reiniciar:
```bash
docker-compose -f docker-compose.vps.yml restart
```

### Status:
```bash
docker-compose -f docker-compose.vps.yml ps
curl http://localhost:3300/health
```

---

## 🆘 Problemas?

1. **Ver logs detalhados:**
   ```bash
   docker logs mercadoflow-backend --tail=200
   ```

2. **Rebuild completo:**
   ```bash
   docker-compose -f docker-compose.vps.yml down
   docker-compose -f docker-compose.vps.yml build --no-cache
   docker-compose -f docker-compose.vps.yml up -d
   ```

3. **Consultar:** [DEPLOY.md](./DEPLOY.md) (documentação completa)

---

## 📦 Volumes Persistentes

- `mercadoflow_backend_data` → Banco SQLite
- `mercadoflow_redis_data` → Cache Redis
- `mercadoflow_backend_uploads` → Uploads
- `mercadoflow_backend_logs` → Logs

**⚠️ NUNCA usar `docker-compose down -v` (apaga volumes!)**

---

## ✅ Checklist

- [ ] Docker instalado na VPS
- [ ] GitHub Secret `VPS_PASSWORD` configurado
- [ ] Push para `main` branch
- [ ] SSL configurado com certbot
- [ ] Health check OK: `curl https://mercadoflow.com/health`
- [ ] Login funcionando

---

**Deploy completo!** 🎉

Para mais detalhes, consulte [DEPLOY.md](./DEPLOY.md)
