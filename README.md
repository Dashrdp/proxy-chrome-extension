# Remote Proxy Manager - Chrome Extension

A comprehensive Chrome extension and server solution for remotely configuring proxy settings on Windows machines via RDP. This tool automatically extracts server credentials from web pages and executes proxy configuration scripts on remote Windows servers.

## 🚀 Features

### Chrome Extension
- **Auto-Extract Credentials**: Automatically detects and extracts server IPs, passwords, and proxy settings from web pages
- **Form Validation**: Built-in validation for IP addresses and proxy formats
- **Secure Storage**: Safely stores form data using Chrome's storage API
- **Real-time Status**: Live feedback during script execution
- **Modern UI**: Clean, responsive interface with professional styling

### Backend Server
- **Remote Execution**: Connects to Windows machines via PowerShell Remoting (pypsrp)
- **Proxy Configuration**: Automatically configures system-wide proxy settings
- **IP Verification**: Verifies proxy functionality by checking public IP and ISP information
- **RESTful API**: Clean API endpoints for extension communication
- **Security**: API key authentication and request validation
- **Monitoring**: Comprehensive logging and health check endpoints
- **Docker Support**: Production-ready containerization

## 📁 Project Structure

```
proxy-chrome-extension/
├── chrome-extension/          # Chrome extension files
│   ├── manifest.json         # Extension manifest
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Popup functionality
│   ├── popup.css            # Popup styling
│   ├── background.js        # Background service worker
│   └── content.js           # Content script for page extraction
├── server/                   # Backend server
│   ├── server.py            # Main Flask server
│   ├── python_script.py     # Core proxy management logic
│   ├── requirements.txt     # Python dependencies
│   ├── docker-compose.yml   # Docker orchestration
│   ├── Dockerfile           # Container configuration
│   ├── nginx.conf           # Nginx configuration
│   ├── env.example          # Environment variables template
│   └── local_server.py      # Local development server
└── README.md                # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.8+
- Chrome Browser
- Docker (optional, for containerized deployment)
- Windows target machines with PowerShell Remoting enabled

### 1. Chrome Extension Setup

1. **Load Extension in Developer Mode**:
   ```bash
   # Navigate to Chrome Extensions page
   chrome://extensions/
   
   # Enable Developer Mode
   # Click "Load unpacked" and select the chrome-extension/ folder
   ```

2. **Configure Server URL**:
   - Edit `chrome-extension/background.js`
   - Update `SERVER_CONFIG.url` with your server URL
   - Set your API key in `SERVER_CONFIG.apiKey`

### 2. Server Setup

#### Option A: Local Development
```bash
# Navigate to server directory
cd server/

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export API_KEY="your-secret-api-key-here"
export HOST="0.0.0.0"
export PORT="5000"

# Run the server
python server.py
```

#### Option B: Docker Deployment

##### B1. Using Docker Compose (Recommended)
```bash
# Navigate to server directory
cd server/

# Create environment file
cp env.example .env

# Edit .env file with your settings
nano .env
# Set: API_KEY=your-secret-api-key-here

# Start the server (development mode)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

##### B2. Production Docker Deployment with Nginx
```bash
# Navigate to server directory
cd server/

# Create environment file for production
cp env.example .env

# Edit .env with production settings
nano .env
# Set:
# API_KEY=your-production-api-key-here
# DEBUG=false

# Start production setup with Nginx reverse proxy
docker-compose --profile production up -d

# Check status
docker-compose ps

# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f proxy-manager
docker-compose logs -f nginx
```

##### B3. Manual Docker Build and Run
```bash
# Navigate to server directory
cd server/

# Build the Docker image
docker build -t remote-proxy-manager .

# Run the container
docker run -d \
  --name proxy-manager \
  -p 5000:5000 \
  -e API_KEY="your-secret-api-key-here" \
  -e HOST="0.0.0.0" \
  -e PORT="5000" \
  -e DEBUG="false" \
  -v $(pwd)/logs:/app/logs \
  remote-proxy-manager

# Check container status
docker ps

# View logs
docker logs -f proxy-manager

# Stop container
docker stop proxy-manager

# Remove container
docker rm proxy-manager
```

##### B4. Docker Management Commands
```bash
# Check running containers
docker-compose ps

# Restart services
docker-compose restart

# Update and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# View real-time logs
docker-compose logs -f proxy-manager

# Access container shell (for debugging)
docker-compose exec proxy-manager bash

# Clean up everything
docker-compose down -v --remove-orphans
docker system prune -f
```

### 3. Windows Target Machine Configuration

Enable PowerShell Remoting on target Windows machines:

```powershell
# Run as Administrator
Enable-PSRemoting -Force
Set-WSManQuickConfig -Force

# Configure authentication (if needed)
Set-Item WSMan:\localhost\Service\Auth\Basic $true
Set-Item WSMan:\localhost\Service\AllowUnencrypted $true
```

## 🎯 Usage

### Basic Workflow

1. **Open Extension**: Click the extension icon in Chrome
2. **Auto-Extract** (Optional): Click "Extract from Page" to automatically fill fields from the current webpage
3. **Manual Entry**: Fill in the required fields:
   - **Server IP**: Target Windows machine IP address
   - **Password**: Administrator password for the target machine
   - **Proxy IP:Port**: Proxy server address (e.g., `192.168.1.100:8080`)
4. **Execute**: Click "Execute Script" to configure the proxy
5. **View Results**: Check the status and results in the extension popup

### API Endpoints

#### Execute Script
```bash
POST /api/execute-script
Content-Type: application/json
X-API-Key: your-secret-api-key-here

{
  "serverIp": "192.168.1.100",
  "password": "your_password",
  "proxyIpPort": "proxy.example.com:8080"
}
```

#### Health Check
```bash
GET /api/health
```

#### Server Status
```bash
GET /
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | Server API key for authentication | `your-secret-api-key-here` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `5000` |
| `DEBUG` | Enable debug mode | `false` |

### Chrome Extension Configuration

Edit `chrome-extension/background.js`:

```javascript
const SERVER_CONFIG = {
    url: 'https://your-server.com',  // Your server URL
    apiKey: 'your-secret-api-key-here'  // Your API key
};
```

## 🔒 Security Features

- **API Key Authentication**: All server endpoints require valid API key
- **Input Validation**: Server-side validation of IP addresses and proxy formats
- **Request Logging**: Comprehensive logging of all requests and responses
- **Rate Limiting**: Concurrent request limiting to prevent abuse
- **CORS Protection**: Configured CORS policies for browser security
- **SSL Support**: HTTPS support via Nginx reverse proxy

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot connect to server"**
   - Verify server URL in extension configuration
   - Check if server is running and accessible
   - Verify API key is correct

2. **"Connection error to target machine"**
   - Ensure PowerShell Remoting is enabled on target machine
   - Verify credentials are correct
   - Check network connectivity

3. **"Proxy inactive"**
   - Verify proxy server is running and accessible
   - Check proxy IP and port are correct
   - Ensure target machine can reach proxy server

### Debug Mode

Enable debug logging:
```bash
export DEBUG=true
python server.py
```

Check Chrome extension console:
```bash
# Open Chrome DevTools on extension popup
# Check Console and Network tabs for errors
```

## 📝 Development

### Adding New Features

1. **Extension Features**: Modify files in `chrome-extension/`
2. **Server Features**: Update `server/server.py` or `server/python_script.py`
3. **UI Changes**: Edit `chrome-extension/popup.html` and `popup.css`

### Testing

```bash
# Test server endpoints
curl -X GET http://localhost:5000/api/health

# Test script execution
curl -X POST http://localhost:5000/api/execute-script \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{"serverIp":"192.168.1.100","password":"test","proxyIpPort":"proxy.example.com:8080"}'
```

## 🐳 Docker Deployment Guide

### Environment Configuration

Create your environment file from the example:

```bash
# Copy example environment file
cp server/env.example server/.env

# Edit the environment file
nano server/.env
```

Example `.env` file content:
```bash
# Server Configuration
API_KEY=your-secure-api-key-here-change-this
HOST=0.0.0.0
PORT=5000
DEBUG=false

# Optional: Database or external service configuration
# DATABASE_URL=postgresql://user:password@localhost/db
```

### Docker Compose Services

The `docker-compose.yml` includes two services:

1. **proxy-manager**: Main Flask application
2. **nginx**: Reverse proxy (production profile only)

#### Service Configuration

```yaml
# Main application service
proxy-manager:
  - Runs on port 5000
  - Includes health checks
  - Auto-restarts unless stopped
  - Mounts logs directory for persistence

# Nginx service (production only)
nginx:
  - Runs on ports 80 and 443
  - Provides SSL termination
  - Load balancing and caching
  - Only starts with --profile production
```

### Production Deployment Checklist

1. **Security Setup**:
   ```bash
   # Generate strong API key
   openssl rand -hex 32
   
   # Set restrictive permissions on env file
   chmod 600 .env
   ```

2. **SSL Certificate Setup** (for production with Nginx):
   ```bash
   # Create SSL directory
   mkdir -p server/ssl
   
   # Add your SSL certificates
   cp your-domain.crt server/ssl/
   cp your-domain.key server/ssl/
   ```

3. **Firewall Configuration**:
   ```bash
   # Allow HTTP and HTTPS
   sudo ufw allow 80
   sudo ufw allow 443
   
   # Block direct access to application port
   sudo ufw deny 5000
   ```

4. **Start Production Services**:
   ```bash
   cd server/
   docker-compose --profile production up -d
   ```

### Container Health Monitoring

```bash
# Check container health
docker-compose ps

# Health check endpoint
curl http://localhost:5000/api/health

# Container resource usage
docker stats

# Service-specific health
docker-compose exec proxy-manager curl http://localhost:5000/api/health
```

### Backup and Maintenance

```bash
# Backup logs
tar -czf backup-$(date +%Y%m%d).tar.gz server/logs/

# Update containers
docker-compose pull
docker-compose down
docker-compose up -d

# Database backup (if using external DB)
# docker-compose exec postgres pg_dump -U user dbname > backup.sql
```

### Docker Troubleshooting

#### Common Docker Issues

1. **Port Already in Use**:
   ```bash
   # Find process using port 5000
   sudo lsof -i :5000
   
   # Kill the process or change port in docker-compose.yml
   sudo kill -9 <PID>
   ```

2. **Permission Issues**:
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER server/logs/
   
   # SELinux context (if applicable)
   sudo chcon -Rt svirt_sandbox_file_t server/logs/
   ```

3. **Container Won't Start**:
   ```bash
   # Check container logs
   docker-compose logs proxy-manager
   
   # Inspect container configuration
   docker-compose config
   
   # Validate environment variables
   docker-compose exec proxy-manager env
   ```

4. **Network Issues**:
   ```bash
   # Check Docker networks
   docker network ls
   
   # Inspect network configuration
   docker network inspect server_default
   
   # Test connectivity between containers
   docker-compose exec proxy-manager ping nginx
   ```

#### Performance Tuning

```bash
# Adjust container resources in docker-compose.yml
services:
  proxy-manager:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

#### Container Updates

```bash
# Update to latest images
docker-compose pull

# Recreate containers with new images
docker-compose up -d --force-recreate

# Remove old images
docker image prune -f
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is designed for legitimate system administration purposes. Users are responsible for ensuring they have proper authorization before configuring proxy settings on remote machines. Always follow your organization's security policies and procedures.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review server logs for detailed error information

---

**Made with ❤️ for system administrators and IT professionals**
