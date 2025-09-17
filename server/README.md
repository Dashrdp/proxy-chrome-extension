# Remote Proxy Manager - Production Setup

A production-ready proxy management server with automatic SSL certificate generation using Let's Encrypt.

## Domain Configuration
- **Domain**: `proxyconf.api.dashrdp.cloud`
- **Email**: `dashrdp@gmail.com`
- **SSL**: Automatic Let's Encrypt certificates

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Domain `proxyconf.api.dashrdp.cloud` pointing to your server's IP address
- Ports 80 and 443 open on your server

### 1. Clone and Setup
```bash
git clone <your-repo>
cd proxy-chrome-extension/server
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env and set your API_KEY
```

### 3. Initialize SSL Certificates
```bash
# Make script executable (Linux/macOS)
chmod +x init-letsencrypt.sh

# Run SSL setup
./init-letsencrypt.sh
```

**For Windows PowerShell:**
```powershell
# Run the SSL setup using Docker directly
docker-compose run --rm --entrypoint "sh /app/init-letsencrypt.sh" certbot
```

### 4. Start Production Services
```bash
docker compose up -d
```

## API Endpoints

Your API will be available at:
- **Base URL**: `https://proxyconf.api.dashrdp.cloud`
- **API Endpoints**: `https://proxyconf.api.dashrdp.cloud/api/`
- **Health Check**: `https://proxyconf.api.dashrdp.cloud/health`

### Example API Usage
```bash
# Health check
curl https://proxyconf.api.dashrdp.cloud/health

# API endpoints (replace YOUR_API_KEY)
curl -H "X-API-Key: YOUR_API_KEY" https://proxyconf.api.dashrdp.cloud/api/your-endpoint
```

## Services

The setup includes three main services:

1. **proxy-manager**: Your main application server
2. **nginx**: Reverse proxy with SSL termination
3. **certbot**: Automatic SSL certificate management

## SSL Certificate Management

- Certificates are automatically obtained from Let's Encrypt
- Auto-renewal every 12 hours
- Certificates stored in `./data/certbot/conf`

## Monitoring

Check service status:
```bash
# View logs
docker compose logs -f

# Check individual service
docker compose logs -f nginx
docker compose logs -f proxy-manager
docker compose logs -f certbot
```

## Security Features

- HTTPS-only with HTTP redirect
- Security headers (HSTS, X-Frame-Options, etc.)
- Rate limiting (10 requests/minute per IP)
- CORS configuration
- SSL best practices

## Troubleshooting

### SSL Certificate Issues
1. Ensure your domain points to the server
2. Check ports 80 and 443 are accessible
3. Run SSL setup again: `./init-letsencrypt.sh`

### Service Issues
```bash
# Restart services
docker compose restart

# Rebuild if needed
docker compose up --build -d
```

### Logs
```bash
# Check all logs
docker compose logs

# Check specific service
docker compose logs nginx
docker compose logs proxy-manager
```

## Production Notes

1. **Change the default API key** in your `.env` file
2. **Firewall**: Only ports 80, 443, and 22 (SSH) should be open
3. **Backups**: Consider backing up `./data/certbot/conf` directory
4. **Monitoring**: Set up monitoring for your services

## File Structure
```
server/
├── docker-compose.yml     # Production Docker configuration
├── nginx.conf            # Nginx reverse proxy config
├── Dockerfile            # Application container
├── init-letsencrypt.sh    # SSL certificate setup script
├── env.example           # Environment variables template
├── requirements.txt      # Python dependencies
├── server.py            # Main application
└── data/                # SSL certificates (auto-created)
    └── certbot/
        ├── conf/        # Let's Encrypt certificates
        └── www/         # ACME challenge files
```
