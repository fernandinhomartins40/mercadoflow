# MercadoFlow Backend - Production Dockerfile
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    bash \
    tzdata

# Set timezone
ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create app directory
WORKDIR /app

# Copy package files and Prisma schema first
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma/ ./prisma/

# Install dependencies
RUN npm install --omit=dev && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Remove dev dependencies and source files
RUN npm prune --production && \
    rm -rf src/ tsconfig.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mercadoflow -u 1001

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/uploads && \
    chown -R mercadoflow:nodejs /app

# Switch to non-root user
USER mercadoflow

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start application
CMD ["node", "dist/index.js"]

# Development stage
FROM base AS development

# Switch back to root for development tools
USER root

# Install development dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Switch back to app user
USER mercadoflow

# Start in development mode
CMD ["npm", "run", "dev"]