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
# The nginx.conf already has SSL configuration, so we just need to restart

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