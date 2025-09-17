# MercadoFlow Nginx - Custom Dockerfile
FROM nginx:alpine

# Install additional packages
RUN apk add --no-cache \
    curl \
    certbot \
    certbot-nginx \
    openssl

# Create nginx user with specific UID/GID
RUN addgroup -g 1001 -S nginx-custom && \
    adduser -S nginx-custom -u 1001 -G nginx-custom

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for SSL certificates
RUN mkdir -p /etc/nginx/ssl && \
    chown -R nginx-custom:nginx-custom /etc/nginx/ssl

# Create directory for logs
RUN mkdir -p /var/log/nginx && \
    chown -R nginx-custom:nginx-custom /var/log/nginx

# Create directory for cache
RUN mkdir -p /var/cache/nginx && \
    chown -R nginx-custom:nginx-custom /var/cache/nginx

# Create directory for pid file
RUN mkdir -p /var/run && \
    chown -R nginx-custom:nginx-custom /var/run

# Generate self-signed certificate for development
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/mercadoflow.key \
    -out /etc/nginx/ssl/mercadoflow.crt \
    -subj "/C=BR/ST=SP/L=SaoPaulo/O=MercadoFlow/OU=IT/CN=mercadoflow.com/emailAddress=admin@mercadoflow.com" && \
    chown nginx-custom:nginx-custom /etc/nginx/ssl/*

# Copy health check script
COPY <<EOF /usr/local/bin/health-check.sh
#!/bin/sh
curl -f http://localhost/health || exit 1
EOF

RUN chmod +x /usr/local/bin/health-check.sh

# Switch to non-root user
USER nginx-custom

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /usr/local/bin/health-check.sh

# Start nginx
CMD ["nginx", "-g", "daemon off;"]