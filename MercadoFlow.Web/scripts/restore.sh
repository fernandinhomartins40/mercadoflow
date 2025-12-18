#!/bin/bash
# Script de restauração do banco de dados
# Uso: ./restore.sh <arquivo_backup.db.gz>

set -e

if [ -z "$1" ]; then
  echo "❌ Erro: Especifique o arquivo de backup!"
  echo "Uso: $0 <arquivo_backup.db.gz>"
  echo ""
  echo "Backups disponíveis:"
  ls -lh /root/mercadoflow-web/backups/*.db.gz 2>/dev/null || echo "Nenhum backup encontrado"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

echo "=== MercadoFlow Restore Script ==="
echo "⚠️  AVISO: Esta operação irá SUBSTITUIR o banco de dados atual!"
echo "Backup a ser restaurado: ${BACKUP_FILE}"
echo ""
read -p "Deseja continuar? (digite 'sim' para confirmar): " CONFIRM

if [ "${CONFIRM}" != "sim" ]; then
  echo "❌ Operação cancelada"
  exit 0
fi

# Verificar se container está rodando
if ! docker ps | grep -q mercadoflow-backend; then
  echo "❌ Erro: Container mercadoflow-backend não está rodando!"
  exit 1
fi

# Criar backup de segurança antes de restaurar
echo ""
echo "📦 Criando backup de segurança do banco atual..."
SAFETY_BACKUP="/root/mercadoflow-web/backups/pre_restore_$(date +%Y%m%d_%H%M%S).db"
if docker exec mercadoflow-backend test -f /app/data/mercadoflow.db; then
  docker exec mercadoflow-backend sqlite3 /app/data/mercadoflow.db ".backup /app/data/backup_safety.db"
  docker cp mercadoflow-backend:/app/data/backup_safety.db "${SAFETY_BACKUP}"
  docker exec mercadoflow-backend rm /app/data/backup_safety.db
  echo "✅ Backup de segurança criado: ${SAFETY_BACKUP}"
else
  echo "ℹ️  Banco atual não existe, pulando backup de segurança"
fi

# Descomprimir se necessário
TEMP_FILE="/tmp/restore_mercadoflow.db"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  echo ""
  echo "🗜️ Descomprimindo backup..."
  gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
else
  cp "${BACKUP_FILE}" "${TEMP_FILE}"
fi

# Verificar integridade do backup
echo ""
echo "🔍 Verificando integridade do backup..."
if ! sqlite3 "${TEMP_FILE}" "PRAGMA integrity_check;" | grep -q "ok"; then
  echo "❌ Erro: Backup corrompido!"
  rm -f "${TEMP_FILE}"
  exit 1
fi
echo "✅ Backup íntegro"

# Parar aplicação temporariamente
echo ""
echo "⏸️  Parando aplicação..."
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml stop backend cron-jobs

# Copiar backup para container
echo ""
echo "📋 Restaurando banco de dados..."
docker cp "${TEMP_FILE}" mercadoflow-backend:/app/data/mercadoflow.db

# Ajustar permissões
docker exec mercadoflow-backend chown mercadoflow:nodejs /app/data/mercadoflow.db
docker exec mercadoflow-backend chmod 644 /app/data/mercadoflow.db

# Reiniciar aplicação
echo ""
echo "▶️  Reiniciando aplicação..."
docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml start backend cron-jobs

# Aguardar inicialização
echo "⏳ Aguardando aplicação inicializar (15s)..."
sleep 15

# Verificar se aplicação está funcionando
if curl -f http://localhost:3300/health &> /dev/null; then
  echo ""
  echo "✅ Banco de dados restaurado com sucesso!"
  echo ""
  echo "📊 Estatísticas após restauração:"
  docker exec mercadoflow-backend sqlite3 /app/data/mercadoflow.db "
  SELECT
    'Usuários' as tabela, COUNT(*) as registros FROM users
  UNION ALL
  SELECT 'Mercados', COUNT(*) FROM markets
  UNION ALL
  SELECT 'Notas Fiscais', COUNT(*) FROM invoices
  UNION ALL
  SELECT 'Itens de NF', COUNT(*) FROM invoice_items
  UNION ALL
  SELECT 'Produtos', COUNT(*) FROM products;
  "
  echo ""
  echo "💾 Backup de segurança mantido em: ${SAFETY_BACKUP}"
else
  echo ""
  echo "❌ ERRO: Aplicação não está respondendo após restauração!"
  echo "🔄 Tentando reverter para backup de segurança..."

  if [ -f "${SAFETY_BACKUP}" ]; then
    docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml stop backend
    docker cp "${SAFETY_BACKUP}" mercadoflow-backend:/app/data/mercadoflow.db
    docker exec mercadoflow-backend chown mercadoflow:nodejs /app/data/mercadoflow.db
    docker-compose -f /root/mercadoflow-web/docker-compose.vps.yml start backend
    echo "⚠️ Revertido para backup de segurança"
  fi

  exit 1
fi

# Limpar arquivo temporário
rm -f "${TEMP_FILE}"

echo ""
echo "✅ Restauração concluída!"
