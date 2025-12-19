# MercadoFlow Backend - Production Dockerfile
FROM node:20-alpine AS base

# Build argument for cache busting
ARG BUILD_TIMESTAMP
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    bash \
    tzdata \
    openssl \
    openssl-dev \
    wget

# Set timezone
ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app directory
WORKDIR /app

# Copy package files and Prisma schema first
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma/ ./prisma/

# Install all dependencies first (needed for build)
RUN npm install && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

ARG BUILD_TIMESTAMP
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# Install runtime dependencies only
RUN apk add --no-cache \
    sqlite \
    curl \
    bash \
    openssl \
    wget

# Set timezone
ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev && npm cache clean --force

# Copy built application and Prisma files from base
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mercadoflow -u 1001

# Create necessary directories with correct permissions
RUN mkdir -p /app/data /app/logs /app/uploads && \
    chown -R mercadoflow:nodejs /app && \
    chmod -R 755 /app/data /app/logs /app/uploads

# Copy initialization script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown mercadoflow:nodejs /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER mercadoflow

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/api/v1/health/live || exit 1

# Start application with entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/index.js"]

# Development stage
FROM base AS development

# Switch back to root for development tools
USER root

# Install development dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon tsx

# Switch back to app user
USER mercadoflow

# Expose development port
EXPOSE 3001

# Start in development mode
CMD ["npm", "run", "dev"]