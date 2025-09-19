# DashRDP Proxy Configurator Backend API

A Python Flask API that receives data from the DashRDP Proxy Configurator Chrome extension and executes PowerShell scripts to configure proxy settings on remote Windows machines.

## Features

- **RESTful API**: Receives data from Chrome extension via HTTP POST requests
- **PowerShell Execution**: Uses pypsrp to execute PowerShell scripts on remote Windows machines
- **Proxy Configuration**: Automatically configures system-wide and user-level proxy settings
- **IP Information**: Retrieves public IP, ISP, and country information through the configured proxy
- **Error Handling**: Comprehensive error handling and logging
- **API Key Authentication**: Secure API key-based authentication
- **Automatic SSL**: Caddy automatically handles SSL certificate generation and renewal
- **HTTP/3 Support**: Modern HTTP/3 protocol support via Caddy
- **Rate Limiting**: Built-in rate limiting for API protection
- **Security Headers**: Comprehensive security headers for production deployment

## Prerequisites

- Python 3.7 or higher
- Windows machines with PowerShell and WinRM enabled
- Network access to target Windows machines
- Administrator credentials for target machines

## Installation

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd proxy-chrome-extension/server
   ```

2. **Create a virtual environment (recommended)**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure the API key**
   - Open `app.py`
   - Change the `API_KEY` variable to your desired secret key
   - Update the same key in your Chrome extension's `background.js`

## Configuration

### API Key Setup

1. **In the backend (`app.py`)**:
   ```python
   API_KEY = 'your-secret-api-key-here'  # Change this
   ```

2. **In the Chrome extension (`chrome-extension/background.js`)**:
   ```javascript
   const SERVER_CONFIG = {
       url: 'https://proxyconf.api.dashrdp.cloud',  // Your server URL
       apiKey: 'your-secret-api-key-here'  // Same key as above
   };
   ```

### Server Configuration

#### Domain Configuration

Before deploying, update the domain in the `Caddyfile`:

```
proxyconf.api.dashrdp.cloud {
    # Your domain configuration
}
```

Replace `proxyconf.api.dashrdp.cloud` with your actual domain name.

#### Chrome Extension Configuration

Update the server URL in your Chrome extension to point to your deployed API:

```javascript
const SERVER_CONFIG = {
    url: 'https://proxyconf.api.dashrdp.cloud',  // Your actual server URL
    apiKey: 'your-secret-api-key-here'
};
```

## Usage

### Development

Run the API in development mode:

```bash
python app.py
```

The API will be available at `http://localhost:5000`

### Production with Docker

For production deployment with automatic SSL via Caddy:

```bash
# Start services (Caddy will automatically obtain SSL certificates)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

**Note**: Caddy automatically handles SSL certificate generation and renewal via Let's Encrypt. No manual SSL setup is required.

### Manual Docker Deployment

```bash
# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## API Endpoints

### POST /api/execute-script

Executes the PowerShell script with proxy configuration.

**Headers:**
```
Content-Type: application/json
X-API-Key: your-secret-api-key-here
```

**Request Body:**
```json
{
    "serverIp": "192.168.1.100",
    "password": "admin_password",
    "proxyIpPort": "192.168.1.200:8080"
}
```

**Response:**
```json
{
    "success": true,
    "result": "Public IP: 203.0.113.1\nISP: Example ISP\nCountry: US\nTarget IP: 192.168.1.100\nProxy: 192.168.1.200:8080\nStatus: Proxy Active"
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000000",
    "service": "DashRDP Proxy Configurator API"
}
```

### GET /

Root endpoint with API information.

## PowerShell Script

The API executes the following PowerShell script on the target machine:

1. **Sets system-wide proxy** in the Windows Registry
2. **Sets user-level proxy** in the Windows Registry  
3. **Retrieves public IP information** using the configured proxy
4. **Returns IP, ISP, and country** information

## Error Handling

The API includes comprehensive error handling for:

- Invalid API keys
- Missing required fields
- Network connection issues
- PowerShell execution errors
- Remote machine authentication failures

## Security Considerations

1. **API Key**: Use a strong, unique API key
2. **HTTPS**: Deploy with HTTPS in production
3. **Network Security**: Ensure secure network access to target machines
4. **Credentials**: Passwords are transmitted securely via HTTPS
5. **Logging**: Sensitive information is not logged

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if the API server is running
   - Verify the server URL in the Chrome extension
   - Check firewall settings

2. **Authentication Failed**
   - Verify the API key matches in both backend and extension
   - Check if the target machine credentials are correct

3. **PowerShell Execution Failed**
   - Ensure WinRM is enabled on target machines
   - Check if the target machine is accessible
   - Verify Administrator credentials

4. **Proxy Configuration Not Applied**
   - Check if the target machine allows registry modifications
   - Verify the proxy IP:Port format is correct

### Logs

The API logs all requests and errors. Check the console output or log files for detailed error information.

**Viewing Caddy logs:**
```bash
# View all service logs
docker compose logs -f

# View only Caddy logs
docker compose logs -f caddy

# View Flask API logs
docker compose logs -f proxy-api
```

**Caddy access logs** are stored in `/var/log/caddy/access.log` within the container.

## Development

### Testing the API

You can test the API using curl:

```bash
curl -X POST https://proxyconf.api.dashrdp.cloud/api/execute-script \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "serverIp": "192.168.1.100",
    "password": "admin_password",
    "proxyIpPort": "192.168.1.200:8080"
  }'
```

## License

This project is licensed under the MIT License.
