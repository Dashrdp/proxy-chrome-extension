#!/bin/bash

# SSL Setup Script for DashRDP Proxy Configurator API
# This script sets up SSL certificates using Let's Encrypt

set -e

DOMAIN="proxyconf.api.dashrdp.cloud"
EMAIL="admin@dashrdp.cloud"

echo "🔐 Setting up SSL certificates for $DOMAIN"

# Create necessary directories
sudo mkdir -p /var/www/certbot
sudo mkdir -p /etc/letsencrypt

# Check if domain is pointing to this server
echo "🌐 Checking if domain $DOMAIN points to this server..."
PUBLIC_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

if [ "$PUBLIC_IP" != "$DOMAIN_IP" ]; then
    echo "❌ Error: Domain $DOMAIN does not point to this server's IP ($PUBLIC_IP)"
    echo "   Domain resolves to: $DOMAIN_IP"
    echo "   Please update your DNS records first."
    exit 1
fi

echo "✅ Domain $DOMAIN correctly points to this server ($PUBLIC_IP)"

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ docker compose command not found. Please install Docker Compose V2."
    echo "   Install instructions: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ docker compose is available"

# Create webroot directory
echo "📁 Creating webroot directory..."
sudo mkdir -p /var/www/certbot

# Copy HTTP-only nginx config for initial setup
echo "📝 Setting up nginx for HTTP-only mode (SSL setup)..."
cp nginx/nginx-http-only.conf nginx/nginx.conf

# Start nginx without SSL first
echo "🚀 Starting nginx for initial certificate request..."
docker compose up -d nginx

# Wait for nginx to be ready
echo "⏳ Waiting for nginx to be ready..."
sleep 15

# Test if nginx is serving the challenge directory
echo "🔍 Testing nginx challenge directory..."
if curl -f -s http://$DOMAIN/.well-known/acme-challenge/ > /dev/null; then
    echo "✅ Nginx is serving challenge directory"
else
    echo "❌ Nginx is not serving challenge directory properly"
    echo "🔍 Checking nginx logs..."
    docker compose logs nginx
    exit 1
fi

# Request SSL certificate
echo "📜 Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot

# Update nginx configuration to use SSL
echo "🔄 Updating nginx configuration for SSL..."
# We need to restore the full SSL configuration
# First, let's create a backup of the current HTTP-only config
cp nginx/nginx.conf nginx/nginx-http-only.conf.backup

# Now restore the full SSL configuration
# We'll recreate the full nginx.conf with SSL
cat > nginx/nginx.conf << 'EOF'
# Nginx configuration for DashRDP Proxy Configurator API
# Production-ready configuration with SSL and security headers

events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;

    # Upstream for Flask API
    upstream flask_app {
        server proxy-api:5000;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name proxyconf.api.dashrdp.cloud;
        
        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            try_files $uri =404;
        }
        
        # Redirect all other traffic to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name proxyconf.api.dashrdp.cloud;
        
        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/proxyconf.api.dashrdp.cloud/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/proxyconf.api.dashrdp.cloud/privkey.pem;
        
        # SSL Security
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_stapling on;
        ssl_stapling_verify on;
        
        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';" always;
        
        # Hide Nginx version
        server_tokens off;
        
        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_proxied any;
        gzip_comp_level 6;
        gzip_types
            text/plain
            text/css
            text/xml
            text/javascript
            application/json
            application/javascript
            application/xml+rss
            application/atom+xml
            image/svg+xml;
        
        # API endpoints with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://flask_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port $server_port;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
            
            # Buffer settings
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            
            # CORS headers for Chrome extension
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, X-API-Key, Authorization" always;
            
            # Handle preflight requests
            if ($request_method = 'OPTIONS') {
                add_header Access-Control-Allow-Origin "*";
                add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
                add_header Access-Control-Allow-Headers "Content-Type, X-API-Key, Authorization";
                add_header Access-Control-Max-Age 86400;
                add_header Content-Length 0;
                add_header Content-Type text/plain;
                return 204;
            }
        }
        
        # Health check endpoint
        location /api/health {
            limit_req zone=general burst=10 nodelay;
            
            proxy_pass http://flask_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Root endpoint
        location / {
            limit_req zone=general burst=10 nodelay;
            
            proxy_pass http://flask_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Block access to sensitive files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }
        
        location ~ ~$ {
            deny all;
            access_log off;
            log_not_found off;
        }
    }

} # End of http block
EOF

# Restart nginx with SSL
echo "🔄 Restarting nginx with SSL configuration..."
docker compose restart nginx

# Start all services
echo "🚀 Starting all services..."
docker compose up -d

# Check if everything is working
echo "🔍 Checking if services are running..."
sleep 10

if curl -f -s https://$DOMAIN/api/health > /dev/null; then
    echo "✅ SSL setup completed successfully!"
    echo "🌐 Your API is now available at: https://$DOMAIN"
    echo "🔗 Health check: https://$DOMAIN/api/health"
else
    echo "❌ SSL setup completed but API is not responding"
    echo "🔍 Check logs with: docker compose logs"
fi

echo ""
echo "📋 Next steps:"
echo "1. Update your Chrome extension to use: https://$DOMAIN"
echo "2. Set your API key in both the extension and backend"
echo "3. Monitor logs: docker compose logs -f"
echo "4. SSL certificates will auto-renew every 12 hours"