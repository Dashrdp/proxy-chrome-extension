# Production Deployment Guide

Complete guide for deploying the DashRDP Proxy Configurator API to Ubuntu server with automatic SSL using Caddy and Docker Compose.

## 🚀 Quick Start

### Prerequisites

- Ubuntu 20.04+ server
- Docker and Docker Compose installed
- Domain `proxyconf.api.dashrdp.cloud` pointing to your server
- Root or sudo access

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose V2 (included with Docker Desktop or install separately)
# For Ubuntu/Debian:
sudo apt-get update
sudo apt-get install docker compose-plugin

# Or install manually:
# sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker compose
# sudo chmod +x /usr/local/bin/docker compose

# Logout and login to apply docker group changes
exit
# Login again
```

### 2. Deploy the Application

```bash
# Clone or upload your project
git clone <your-repo> # or upload files via SCP/SFTP
cd proxy-chrome-extension/server

# Update domain in Caddyfile
nano Caddyfile
# Replace 'proxyconf.api.dashrdp.cloud' with your actual domain

# Start services (Caddy will automatically obtain SSL certificates)
docker compose up -d

# Check status
docker compose ps
```

### 3. Configure API Key and Webhook Secret

```bash
# Set webhook secret for CI/CD (required for automatic deployment)
export WEBHOOK_SECRET="your-strong-webhook-secret-here"

# Generate a secure webhook secret:
openssl rand -hex 32

# Start services with webhook secret
docker compose up -d
```

### 4. Set Up CI/CD Pipeline (Automatic Deployment)

The application includes automatic deployment via GitHub Actions. When you push code to the `main` branch, it will automatically deploy to your server.

#### 4.1. Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

   - **WEBHOOK_SECRET**: The same secret you set in step 3 (use `openssl rand -hex 32` to generate)
   - **WEBHOOK_URL**: Full URL to your webhook endpoint
     - Format: `https://your-domain.com/api/deploy`
     - Example: `https://proxyconf.api.dashrdp.cloud/api/deploy`

#### 4.2. Verify CI/CD Setup

1. The GitHub Actions workflow (`.github/workflows/deploy.yml`) is already configured
2. It triggers on every push to the `main` branch
3. The workflow calls your webhook endpoint with the secret token
4. Your server automatically:
   - Pulls the latest code from git
   - Rebuilds Docker containers
   - Restarts services

#### 4.3. Test the Deployment

```bash
# Make a test commit and push to main branch
git add .
git commit -m "Test CI/CD deployment"
git push origin main

# Watch the deployment in GitHub Actions
# Or check server logs:
docker compose logs -f proxy-api
```

#### 4.4. Manual Deployment (Alternative)

If you prefer manual deployment or need to deploy without git:

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## 🔧 Manual Deployment Steps

If you prefer manual setup:

### 1. Prepare the Server

```bash
# Create project directory
mkdir -p /opt/proxy-api
cd /opt/proxy-api

# Copy all project files here
# (app.py, requirements.txt, Dockerfile, docker compose.yml, Caddyfile)
```

### 2. Configure Domain and Start Services

```bash
# Update domain in Caddyfile
nano Caddyfile
# Replace 'proxyconf.api.dashrdp.cloud' with your actual domain

# Caddy automatically handles SSL certificate generation
# No manual SSL setup required!
```

### 3. Start All Services

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps
```

## 🔐 SSL Certificate Management

### Automatic Management

Caddy automatically handles all SSL certificate management:

- **Automatic Issuance**: Certificates are automatically obtained from Let's Encrypt
- **Automatic Renewal**: Certificates are automatically renewed before expiration
- **Zero Configuration**: No manual intervention required
- **OCSP Stapling**: Automatic OCSP stapling for better performance

```bash
# Check Caddy logs for SSL status
docker compose logs caddy | grep -i cert

# View certificate information
docker compose exec caddy caddy list-certificates
```

## 📊 Monitoring and Maintenance

### Check Service Status

```bash
# View all services
docker compose ps

# Check logs
docker compose logs -f

# Check specific service logs
docker compose logs -f proxy-api
docker compose logs -f caddy
```

### Health Checks

```bash
# API health check
curl https://proxyconf.api.dashrdp.cloud/api/health

# Test API endpoint
curl -X POST https://proxyconf.api.dashrdp.cloud/api/execute-script \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{"serverIp":"192.168.1.100","password":"test","proxyIpPort":"192.168.1.200:8080"}'
```

### Update Application

#### Automatic Update (Recommended)

If CI/CD is configured, simply push to the `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

The deployment will happen automatically via GitHub Actions.

#### Manual Update

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## 🔒 Security Configuration

### Firewall Setup

```bash
# Configure UFW firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (for ACME challenge and redirects)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 443/udp     # HTTP/3 (QUIC)
sudo ufw enable
```

### API Key Security

1. **Generate a strong API key**:
   ```bash
   openssl rand -hex 32
   ```

2. **Update in both places**:
   - `app.py`: `API_KEY = 'your-generated-key'`
   - Chrome extension: `chrome-extension/background.js`

### Environment Variables

For production, consider using environment variables:

```bash
# Create .env file
cat > .env << EOF
API_KEY=your-secret-api-key-here
FLASK_ENV=production
EOF

# Update docker compose.yml to use .env
# Add to proxy-api service:
# env_file:
#   - .env
```

## 🐛 Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check Caddy certificate status
   docker compose exec caddy caddy list-certificates
   
   # Check Caddy logs for SSL-related messages
   docker compose logs caddy | grep -i -E "(cert|ssl|acme|tls)"
   
   # Test certificate validity
   openssl s_client -connect proxyconf.api.dashrdp.cloud:443 -servername proxyconf.api.dashrdp.cloud
   ```

2. **API Not Responding**
   ```bash
   # Check API logs
   docker compose logs proxy-api
   
   # Check Caddy logs
   docker compose logs caddy
   
   # Test internal connectivity
   docker compose exec caddy curl http://proxy-api:5000/api/health
   ```

3. **Domain Not Resolving**
   ```bash
   # Check DNS
   dig proxyconf.api.dashrdp.cloud
   nslookup proxyconf.api.dashrdp.cloud
   ```

4. **Port Conflicts**
   ```bash
   # Check what's using ports 80/443
   sudo netstat -tlnp | grep :80
   sudo netstat -tlnp | grep :443
   
   # Stop conflicting services
   sudo systemctl stop apache2  # if running
   sudo systemctl stop nginx    # if running
   sudo systemctl stop caddy    # if running system-wide
   ```

### Log Analysis

```bash
# Real-time logs
docker compose logs -f --tail=100

# API errors only
docker compose logs proxy-api | grep ERROR

# Caddy access logs
docker compose exec caddy tail -f /var/log/caddy/access.log
```

## 📈 Performance Optimization

### Caddy Optimization

The Caddy configuration includes:
- Automatic Gzip compression
- Rate limiting per endpoint
- Security headers
- HTTP/2 and HTTP/3 support
- Automatic HTTPS
- Zero-downtime reloads

### Application Optimization

The Flask app uses:
- Gunicorn with 4 workers
- Connection keep-alive
- Request limits
- Health checks

### Monitoring

```bash
# Resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -f
```

## 🔄 Backup and Recovery

### Backup SSL Certificates

```bash
# Backup Caddy data (includes certificates)
docker compose exec caddy tar -czf /tmp/caddy-backup-$(date +%Y%m%d).tar.gz /data
docker cp proxy-caddy:/tmp/caddy-backup-$(date +%Y%m%d).tar.gz ./
```

### Backup Application Data

```bash
# Backup project
tar -czf proxy-api-backup-$(date +%Y%m%d).tar.gz /opt/proxy-api
```

### Recovery

```bash
# Restore application backup
tar -xzf proxy-api-backup-YYYYMMDD.tar.gz -C /

# Restore Caddy data
docker cp caddy-backup-YYYYMMDD.tar.gz proxy-caddy:/tmp/
docker compose exec caddy tar -xzf /tmp/caddy-backup-YYYYMMDD.tar.gz -C /

# Restart services
docker compose restart
```

## 🌐 DNS Configuration

Ensure your domain points to your server:

```bash
# Check current DNS
dig proxyconf.api.dashrdp.cloud

# Should return your server's public IP
```

## ✅ Verification Checklist

- [ ] Domain points to server IP
- [ ] SSL certificate is valid
- [ ] API responds to health check
- [ ] Chrome extension can connect
- [ ] API key is configured
- [ ] Firewall allows ports 80/443 (TCP) and 443 (UDP)
- [ ] Caddy automatic SSL management is working
- [ ] Logs are being generated
- [ ] Services restart on reboot
- [ ] CI/CD pipeline configured (GitHub Secrets set)
- [ ] Webhook secret configured in environment
- [ ] Test deployment successful

## 📞 Support

If you encounter issues:

1. Check the logs: `docker compose logs -f`
2. Verify DNS: `dig proxyconf.api.dashrdp.cloud`
3. Test SSL: `curl -I https://proxyconf.api.dashrdp.cloud`
4. Check firewall: `sudo ufw status`

## 🎯 Production Checklist

- [ ] Strong API key configured
- [ ] SSL certificates valid
- [ ] Firewall configured
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Log rotation configured
- [ ] Health checks working
- [ ] Caddy SSL automation tested
- [ ] Performance optimized
- [ ] Security headers enabled
- [ ] CI/CD pipeline configured and tested
- [ ] Webhook secret is strong and secure
- [ ] GitHub Actions workflow is working
- [ ] Automatic deployment tested successfully

## 🔄 CI/CD Pipeline Details

### How It Works

1. **Developer pushes to main branch** → GitHub Actions workflow triggers
2. **GitHub Actions calls webhook** → Sends POST request to `/api/deploy` endpoint
3. **Webhook validates secret** → Ensures request is authorized
4. **Deployment script executes** → Runs `deploy.sh` which:
   - Pulls latest code from git
   - Rebuilds Docker containers
   - Restarts services
5. **Deployment completes** → Application is updated automatically

### Webhook Endpoint

- **URL**: `https://your-domain.com/api/deploy`
- **Method**: POST
- **Headers**: 
  - `Content-Type: application/json`
  - `X-Webhook-Secret: <your-webhook-secret>`
- **Response**: 202 Accepted (deployment triggered asynchronously)

### Troubleshooting CI/CD

If automatic deployment fails:

1. **Check GitHub Actions logs**:
   - Go to your repository → Actions tab
   - View the latest workflow run

2. **Check server logs**:
   ```bash
   docker compose logs -f proxy-api
   ```

3. **Verify webhook secret**:
   ```bash
   # Check if webhook secret is set
   docker compose exec proxy-api env | grep WEBHOOK_SECRET
   ```

4. **Test webhook manually**:
   ```bash
   curl -X POST https://your-domain.com/api/deploy \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: your-webhook-secret" \
     -d '{"ref":"refs/heads/main","sha":"test","repository":"test","pusher":"test"}'
   ```

5. **Check deployment script**:
   ```bash
   # Verify script exists and is executable
   ls -la server/deploy.sh
   ```

6. **Verify git access**:
   ```bash
   # Check if git repository is accessible
   docker compose exec proxy-api git status
   ```
