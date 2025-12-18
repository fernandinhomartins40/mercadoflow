#!/bin/bash
# Script de backup manual do banco de dados SQLite
# Uso: ./backup.sh [nome_do_backup]

set -e

BACKUP_NAME="${1:-manual_$(date +%Y%m%d_%H%M%S)}"
BACKUP_DIR="/root/mercadoflow-web/backups"
APP_DIR="/root/mercadoflow-web"

echo "=== MercadoFlow Backup Script ==="
echo "Backup: ${BACKUP_NAME}"
echo ""

# Criar diretório de backups
mkdir -p "${BACKUP_DIR}"

# Verificar se container está rodando
if ! docker ps | grep -q mercadoflow-backend; then
  echo "❌ Erro: Container mercadoflow-backend não está rodando!"
  exit 1
fi

# Verificar se banco existe
if ! docker exec mercadoflow-backend test -f /app/data/mercadoflow.db; then
  echo "❌ Erro: Banco de dados não encontrado!"
  exit 1
fi

echo "📊 Criando backup do banco de dados..."

# Método 1: Backup usando sqlite3 (mais seguro)
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.db"
docker exec mercadoflow-backend sqlite3 /app/data/mercadoflow.db ".backup /app/data/backup_temp.db"
docker cp mercadoflow-backend:/app/data/backup_temp.db "${BACKUP_FILE}"
docker exec mercadoflow-backend rm /app/data/backup_temp.db

# Verificar se backup foi criado
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "❌ Erro: Backup falhou ou está vazio!"
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup criado com sucesso: ${BACKUP_FILE}"
echo "📦 Tamanho: ${BACKUP_SIZE}"

# Comprimir backup
echo "🗜️ Comprimindo backup..."
gzip -f "${BACKUP_FILE}"
COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "✅ Backup comprimido: ${BACKUP_FILE}.gz (${COMPRESSED_SIZE})"

# Criar link simbólico para último backup
ln -sf "${BACKUP_FILE}.gz" "${BACKUP_DIR}/latest.db.gz"

# Listar estatísticas do banco
echo ""
echo "📊 Estatísticas do banco de dados:"
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

# Manter apenas últimos 14 backups
echo ""
echo "🧹 Limpando backups antigos (mantendo últimos 14)..."
cd "${BACKUP_DIR}"
ls -t ${BACKUP_NAME%_*}_*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm
BACKUP_COUNT=$(ls -1 *.db.gz 2>/dev/null | wc -l)
echo "✅ Total de backups mantidos: ${BACKUP_COUNT}"

# Upload para S3 (opcional)
if [ -n "${AWS_S3_BUCKET}" ]; then
  echo ""
  echo "☁️ Enviando backup para S3..."
  if command -v aws &> /dev/null; then
    aws s3 cp "${BACKUP_FILE}.gz" "s3://${AWS_S3_BUCKET}/mercadoflow/backups/" || echo "⚠️ Falha ao enviar para S3"
  else
    echo "⚠️ AWS CLI não instalado, pulando upload para S3"
  fi
fi

echo ""
echo "✅ Backup concluído com sucesso!"
