# 🧪 Testando Deploy Localmente

Antes de fazer deploy na VPS, você pode testar todo o setup localmente.

## 🐳 Teste Local com Docker

### 1. Build das imagens

```bash
cd MercadoFlow.Web
export BUILD_TIMESTAMP=$(date +%s)
docker-compose -f docker-compose.vps.yml build
```

### 2. Criar arquivo .env local

```bash
cat > .env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000
NGINX_PORT=3300

DATABASE_URL=file:/app/data/mercadoflow.db
REDIS_URL=redis://redis:6379

JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

REACT_APP_API_BASE_URL=http://localhost:3300/api
REACT_APP_ENVIRONMENT=production

CORS_ORIGIN=http://localhost:3300

BUILD_TIMESTAMP=$(date +%s)
EOF
```

### 3. Iniciar containers

```bash
docker-compose -f docker-compose.vps.yml up -d
```

### 4. Verificar logs

```bash
# Ver todos os logs
docker-compose -f docker-compose.vps.yml logs -f

# Ou logs individuais
docker logs mercadoflow-backend -f
docker logs mercadoflow-frontend -f
docker logs mercadoflow-nginx -f
```

### 5. Testar aplicação

```bash
# Health check
curl http://localhost:3300/health
curl http://localhost:3300/api/v1/health

# Frontend (no navegador)
open http://localhost:3300
```

### 6. Parar containers

```bash
docker-compose -f docker-compose.vps.yml down
```

---

## ✅ Validações

### Backend está OK se:
- [ ] Health check responde: `curl http://localhost:3300/api/v1/health`
- [ ] Swagger docs acessível: `http://localhost:3300/api-docs`
- [ ] Logs sem erros: `docker logs mercadoflow-backend --tail=50`

### Frontend está OK se:
- [ ] Página carrega: `http://localhost:3300`
- [ ] Console sem erros críticos (F12)
- [ ] Requisições à API funcionam

### Nginx está OK se:
- [ ] Roteamento funciona (frontend e API)
- [ ] Headers corretos no response
- [ ] Logs sem erros: `docker logs mercadoflow-nginx`

### Redis está OK se:
- [ ] Ping responde: `docker exec mercadoflow-redis redis-cli ping`
- [ ] Conecta do backend

### Database está OK se:
- [ ] Arquivo criado: `docker exec mercadoflow-backend ls -lh /app/data/`
- [ ] Tabelas criadas: `docker exec mercadoflow-backend sqlite3 /app/data/mercadoflow.db ".tables"`
- [ ] Seed executado (usuário admin existe)

---

## 🔍 Debug

### Ver estrutura do container

```bash
# Backend
docker exec -it mercadoflow-backend sh
ls -la /app
ls -la /app/data
exit

# Frontend
docker exec -it mercadoflow-frontend sh
ls -la /usr/share/nginx/html
exit
```

### Ver variáveis de ambiente

```bash
docker exec mercadoflow-backend env | grep -E "NODE_ENV|DATABASE_URL|PORT"
```

### Inspecionar rede

```bash
docker network inspect mercadoflow_network
```

### Ver uso de recursos

```bash
docker stats
```

---

## 🧹 Limpeza Completa

```bash
# Parar e remover containers
docker-compose -f docker-compose.vps.yml down

# Remover volumes (⚠️ apaga dados!)
docker volume rm mercadoflow_backend_data
docker volume rm mercadoflow_redis_data
docker volume rm mercadoflow_backend_logs
docker volume rm mercadoflow_backend_uploads

# Remover imagens
docker rmi $(docker images | grep mercadoflow | awk '{print $3}')

# Limpar sistema
docker system prune -af
```

---

## 🎯 Próximos Passos

Se tudo funcionar localmente:

1. ✅ Commit e push para GitHub
2. ✅ GitHub Actions fará deploy automático
3. ✅ Configurar SSL na VPS após deploy

---

**Pronto para produção!** 🚀
