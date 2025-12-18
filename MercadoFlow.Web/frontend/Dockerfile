# MercadoFlow Frontend - Production Dockerfile
FROM node:20-alpine AS build

# Build arguments
ARG BUILD_TIMESTAMP
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_ENVIRONMENT=production

ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
ENV REACT_APP_ENVIRONMENT=${REACT_APP_ENVIRONMENT}

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

ARG BUILD_TIMESTAMP
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# Install dependencies for health checks
RUN apk add --no-cache curl wget

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx && \
    mkdir -p /var/run && \
    touch /var/run/nginx.pid

# Set proper permissions (nginx already runs as nginx user)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    chmod -R 755 /usr/share/nginx/html

# Switch to nginx user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose development port
EXPOSE 3001

# Start development server
CMD ["npm", "run", "dev"]