#!/bin/bash
set -e

echo "=== MercadoFlow Backend Initialization ==="
echo "Timestamp: $(date)"
echo "Node version: $(node --version)"
echo "Environment: ${NODE_ENV}"

# Wait for database directory to be ready
echo "Checking database directory..."
if [ ! -d "/app/data" ]; then
    echo "ERROR: Data directory not found"
    exit 1
fi

# Check if database exists
if [ ! -f "/app/data/mercadoflow.db" ]; then
    echo "Database not found, initializing..."

    # Run Prisma migrations
    echo "Running Prisma migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma

    # Run seed if available
    if [ -f "./prisma/seed.ts" ]; then
        echo "Running database seed..."
        npx tsx ./prisma/seed.ts || echo "Warning: Seed failed, continuing..."
    fi

    echo "Database initialized successfully"
else
    echo "Database found, checking for pending migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "Warning: Migration check failed"
fi

# Generate Prisma client if needed
echo "Ensuring Prisma client is generated..."
npx prisma generate --schema=./prisma/schema.prisma

echo "Starting application..."
exec "$@"
