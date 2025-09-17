# Remote Proxy Manager - Docker & SSL Deployment Guide

## Overview

This guide covers the enhanced Docker and Nginx setup with SSL support for the Remote Proxy Manager. The system now supports multiple deployment modes and comprehensive SSL configuration.

## 🚀 Quick Deployment

### Production (HTTPS with SSL)
```bash
cd server/
chmod +x ssl-setup.sh
./ssl-setup.sh --domain your-domain.com --email your@email.com --method letsencrypt
cp env.example .env
echo "API_KEY=$(openssl rand -hex 32)" >> .env
docker compose --profile production up -d
```

### Development (HTTP)
```bash
cd server/
docker compose --profile development up -d
```

## 📋 What's New

### 1. Enhanced Docker Compose Configuration
- **Production Profile**: Nginx reverse proxy with SSL termination
- **Development Profile**: Direct port access for local development
- **Default Mode**: Internal-only access for custom proxy setups

### 2. Comprehensive SSL Support
- **Let's Encrypt**: Automated certificate generation and renewal
- **CloudFlare Origin**: Support for CloudFlare SSL certificates
- **Self-Signed**: Development certificates with proper configuration
- **SSL Setup Script**: Automated certificate management

### 3. Enhanced Nginx Configuration
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Rate Limiting**: API endpoint protection
- **CORS Support**: Chrome extension compatibility
- **SSL Optimization**: Modern cipher suites and protocols

### 4. Chrome Extension HTTPS Support
- **HTTPS Default**: Pre-configured for secure endpoints
- **SSL Compatibility**: Proper CORS and certificate handling
- **Configuration Guide**: Easy domain and API key updates

## 🔧 Technical Changes

### File Modifications

#### `docker-compose.yml`
- Added production and development profiles
- Separated services for different deployment scenarios
- Enhanced health checks and restart policies

#### `nginx.conf`
- Added comprehensive SSL configuration
- Enhanced security headers
- Rate limiting for API endpoints
- OCSP stapling support

#### `README.md`
- Complete rewrite of deployment sections
- Added Quick Start guide
- Comprehensive SSL setup instructions
- Enhanced troubleshooting section

#### New Files
- `ssl-setup.sh`: Automated SSL certificate management script
- `DEPLOYMENT_GUIDE.md`: This deployment summary

## 🌐 SSL Certificate Options

### 1. Let's Encrypt (Recommended for Production)
- Free, trusted certificates
- Automatic renewal support
- Works with all browsers and Chrome extensions

### 2. CloudFlare Origin Certificates
- Free for CloudFlare users
- Easy setup through CloudFlare dashboard
- Perfect for CloudFlare-proxied domains

### 3. Self-Signed Certificates
- Quick setup for development
- No external dependencies
- Requires manual certificate acceptance

## 🔒 Security Enhancements

### SSL/TLS Security
- TLS 1.2 and 1.3 support only
- Strong cipher suites
- Perfect Forward Secrecy
- OCSP stapling
- HTTP Strict Transport Security (HSTS)

### Application Security
- API key authentication
- Rate limiting
- CORS protection
- Security headers
- Input validation

## 🚀 Deployment Scenarios

### Scenario 1: Production Server with Domain
```bash
# Setup SSL with Let's Encrypt
./ssl-setup.sh --domain api.yourcompany.com --email admin@yourcompany.com --method letsencrypt

# Start production services
docker compose --profile production up -d

# Update Chrome extension
# Edit chrome-extension/background.js: url: 'https://api.yourcompany.com'
```

### Scenario 2: Development Environment
```bash
# Start development service
docker compose --profile development up -d

# Chrome extension uses: http://localhost:5000
```

### Scenario 3: Custom Reverse Proxy
```bash
# Start only the application service
docker compose up -d

# Configure your own reverse proxy to point to container:5000
```

## 🛠️ Management Commands

### SSL Certificate Management
```bash
# Check certificate expiry
openssl x509 -in server/ssl/cert.pem -noout -dates

# Renew Let's Encrypt certificate
./server/ssl/renew-cert.sh

# Test SSL configuration
curl -I https://your-domain.com/api/health
```

### Container Management
```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Update and rebuild
docker compose down && docker compose pull && docker compose up -d
```

### Chrome Extension Updates
```bash
# After changing server URL/API key:
# 1. Edit chrome-extension/background.js
# 2. Go to chrome://extensions/
# 3. Find "DashRDP Proxy Configurator"
# 4. Click refresh icon
```

## 🔍 Troubleshooting

### SSL Issues
```bash
# Test SSL connection
openssl s_client -connect your-domain.com:443

# Check certificate details
openssl x509 -in server/ssl/cert.pem -text -noout

# Verify Nginx configuration
docker compose exec nginx nginx -t
```

### Chrome Extension Issues
```bash
# Check extension console
# Chrome DevTools -> Extensions -> Inspect views: popup.html -> Console

# Common solutions:
# 1. Accept SSL certificate in browser first
# 2. Check CORS headers in Network tab
# 3. Verify API key and server URL
```

### Container Issues
```bash
# Check service status
docker compose ps

# View service logs
docker compose logs proxy-manager
docker compose logs nginx

# Check health endpoints
curl http://localhost:5000/api/health  # Development
curl https://your-domain.com/api/health  # Production
```

## 📈 Monitoring & Maintenance

### Health Monitoring
- Container health checks every 30 seconds
- API health endpoint: `/api/health`
- Nginx status monitoring
- SSL certificate expiry monitoring

### Log Management
- Application logs: `server/logs/`
- Nginx access logs: Available via `docker compose logs nginx`
- Container logs: `docker compose logs -f`

### Backup Considerations
- Environment file: `server/.env`
- SSL certificates: `server/ssl/`
- Application logs: `server/logs/`
- Docker volumes: As configured in docker-compose.yml

## 🎯 Next Steps

1. **Set up monitoring**: Consider adding monitoring tools for production
2. **Implement log rotation**: For long-running production deployments
3. **Database backup**: If using external databases
4. **Load balancing**: For high-availability deployments
5. **CDN integration**: For global distribution

## 📞 Support

For issues or questions:
1. Check the troubleshooting sections in README.md
2. Review container logs for error details
3. Verify SSL configuration with provided commands
4. Test Chrome extension connectivity

---

**Deployment completed successfully!** Your Remote Proxy Manager is now ready for production use with comprehensive SSL support and enhanced security features.
