#!/bin/bash
set -e

# Enable detailed logging
set -x

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== MercadoFlow Backend Initialization ==="
log "Timestamp: $(date)"
log "Node version: $(node --version)"
log "Environment: ${NODE_ENV}"
log "Working directory: $(pwd)"
log "User: $(whoami)"

# Check if dist directory exists
log "Checking dist directory..."
if [ -d "/app/dist" ]; then
    log "✓ Dist directory exists"
    log "Dist contents:"
    ls -la /app/dist/ || true
    if [ -d "/app/dist/src" ]; then
        log "✓ Dist/src directory exists"
        log "Checking for index.js..."
        if [ -f "/app/dist/src/index.js" ]; then
            log "✓ index.js found at /app/dist/src/index.js"
        else
            log "✗ ERROR: index.js NOT found at /app/dist/src/index.js"
            exit 1
        fi
    else
        log "✗ ERROR: Dist/src directory NOT found"
        exit 1
    fi
else
    log "✗ ERROR: Dist directory NOT found"
    exit 1
fi

# Wait for database directory to be ready
log "Checking database directory..."
if [ ! -d "/app/data" ]; then
    log "✗ ERROR: Data directory not found"
    exit 1
fi
log "✓ Data directory exists"

# Check if database exists
if [ ! -f "/app/data/mercadoflow.db" ]; then
    log "Database not found, initializing..."

    # Run Prisma migrations
    log "Running Prisma migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma

    # Run seed if available
    if [ -f "./prisma/seed.ts" ]; then
        log "Running database seed..."
        npx tsx ./prisma/seed.ts || log "Warning: Seed failed, continuing..."
    fi

    log "✓ Database initialized successfully"
else
    log "✓ Database found, checking for pending migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || log "Warning: Migration check failed"
fi

# Generate Prisma client if needed
log "Ensuring Prisma client is generated..."
npx prisma generate --schema=./prisma/schema.prisma

log "Application will start with command: $@"
log "=== Starting Node.js Application ==="
exec "$@"
