#!/usr/bin/env python3
"""
Production Remote Proxy Manager Server
Flask-based server for hosting the proxy management service
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import json
import os
import logging
from datetime import datetime
import traceback
import threading
import time
from functools import wraps

# Import our proxy script functionality
from python_script import execute_remote_proxy_script, format_output

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('proxy_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
API_KEY = os.environ.get('API_KEY', 'your-secret-api-key-here')
MAX_CONCURRENT_REQUESTS = 10
REQUEST_TIMEOUT = 30

# Request tracking
active_requests = {}
request_lock = threading.Lock()

def require_api_key(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

def log_request(f):
    """Decorator to log all requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        
        logger.info(f"Request from {client_ip}: {request.method} {request.path}")
        
        try:
            result = f(*args, **kwargs)
            duration = time.time() - start_time
            logger.info(f"Request completed in {duration:.2f}s")
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Request failed in {duration:.2f}s: {str(e)}")
            raise
    return decorated_function

@app.route('/')
def home():
    """Server status page"""
    status_page = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Remote Proxy Manager Server</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.95);
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .status { 
                padding: 20px; 
                background: #e8f5e8; 
                border-radius: 8px; 
                border-left: 4px solid #28a745;
                margin: 20px 0;
            }
            .endpoint {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin: 10px 0;
                border-left: 3px solid #007bff;
            }
            code {
                background: #f1f3f4;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
            }
            .example {
                background: #fff3cd;
                padding: 15px;
                border-radius: 8px;
                border-left: 3px solid #ffc107;
                margin: 15px 0;
            }
            h1 { color: #2c3e50; text-align: center; }
            h2 { color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Remote Proxy Manager Server</h1>
            
            <div class="status">
                <h2>✅ Status: Running</h2>
                <p><strong>Server Time:</strong> {{ timestamp }}</p>
                <p><strong>Active Requests:</strong> {{ active_count }}</p>
                <p>Server is ready to accept requests from Chrome extensions.</p>
            </div>

            <h2>📡 API Endpoints</h2>
            
            <div class="endpoint">
                <h3>POST /api/execute-script</h3>
                <p><strong>Description:</strong> Execute remote proxy configuration script</p>
                <p><strong>Authentication:</strong> Required (X-API-Key header)</p>
                <p><strong>Content-Type:</strong> application/json</p>
            </div>

            <div class="endpoint">
                <h3>GET /api/health</h3>
                <p><strong>Description:</strong> Server health check</p>
                <p><strong>Authentication:</strong> Not required</p>
            </div>

            <h2>📝 Usage Example</h2>
            <div class="example">
                <h4>Chrome Extension Configuration:</h4>
                <pre><code>SERVER_URL: {{ base_url }}
API_KEY: your-secret-api-key-here</code></pre>
                
                <h4>cURL Example:</h4>
                <pre><code>curl -X POST {{ base_url }}/api/execute-script \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-secret-api-key-here" \\
  -d '{
    "serverIp": "192.168.1.100",
    "password": "your_password",
    "proxyIpPort": "proxy.example.com:8080"
  }'</code></pre>
            </div>

            <h2>🔐 Security Features</h2>
            <ul>
                <li>API Key authentication required</li>
                <li>Request logging and monitoring</li>
                <li>Concurrent request limiting</li>
                <li>Input validation and sanitization</li>
                <li>CORS protection</li>
            </ul>

            <h2>📊 Monitoring</h2>
            <p>Check server logs at: <code>proxy_server.log</code></p>
            <p>Health endpoint: <a href="/api/health">/api/health</a></p>
        </div>
    </body>
    </html>
    """
    
    with request_lock:
        active_count = len(active_requests)
    
    return render_template_string(
        status_page, 
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'),
        active_count=active_count,
        base_url=request.host_url.rstrip('/')
    )

@app.route('/api/health')
@log_request
def health_check():
    """Health check endpoint"""
    with request_lock:
        active_count = len(active_requests)
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'active_requests': active_count,
        'max_concurrent': MAX_CONCURRENT_REQUESTS
    })

@app.route('/api/execute-script', methods=['POST'])
@require_api_key
@log_request
def execute_script():
    """Execute the remote proxy script"""
    request_id = f"{int(time.time())}_{threading.current_thread().ident}"
    
    try:
        # Check concurrent request limit
        with request_lock:
            if len(active_requests) >= MAX_CONCURRENT_REQUESTS:
                return jsonify({'error': 'Server busy, too many concurrent requests'}), 503
            active_requests[request_id] = {
                'start_time': time.time(),
                'client_ip': request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            }

        # Validate request data
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['serverIp', 'password', 'proxyIpPort']
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Validate IP format
        server_ip = data['serverIp'].strip()
        if not is_valid_ip(server_ip):
            return jsonify({'error': 'Invalid server IP address format'}), 400
        
        # Validate proxy format
        proxy_ip_port = data['proxyIpPort'].strip()
        if not is_valid_proxy_format(proxy_ip_port):
            return jsonify({'error': 'Invalid proxy format, expected IP:Port'}), 400
        
        password = data['password']
        
        logger.info(f"Executing script for server: {server_ip}, proxy: {proxy_ip_port}")
        
        # Execute the script
        result = execute_remote_proxy_script(server_ip, password, proxy_ip_port)
        
        # Format the response
        formatted_output = format_output(result)
        
        logger.info(f"Script execution completed for {server_ip}: {result.get('status', 'unknown')}")
        
        return jsonify({
            'success': True,
            'result': formatted_output,
            'data': result,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Script execution failed: {str(e)}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500
        
    finally:
        # Remove from active requests
        with request_lock:
            active_requests.pop(request_id, None)

def is_valid_ip(ip):
    """Validate IP address format"""
    import re
    ip_pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    return re.match(ip_pattern, ip) is not None

def is_valid_proxy_format(proxy):
    """Validate proxy format (IP:Port)"""
    import re
    proxy_pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}$'
    return re.match(proxy_pattern, proxy) is not None

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

def cleanup_old_requests():
    """Background task to cleanup old request records"""
    while True:
        try:
            current_time = time.time()
            with request_lock:
                expired_requests = [
                    req_id for req_id, req_data in active_requests.items()
                    if current_time - req_data['start_time'] > REQUEST_TIMEOUT
                ]
                for req_id in expired_requests:
                    logger.warning(f"Cleaning up expired request: {req_id}")
                    active_requests.pop(req_id, None)
            
            time.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error in cleanup task: {str(e)}")
            time.sleep(60)

if __name__ == '__main__':
    # Start cleanup background task
    cleanup_thread = threading.Thread(target=cleanup_old_requests, daemon=True)
    cleanup_thread.start()
    
    # Configuration
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Remote Proxy Manager Server on {host}:{port}")
    logger.info(f"API Key authentication: {'Enabled' if API_KEY != 'your-secret-api-key-here' else 'Default (CHANGE THIS!)'}")
    
    app.run(host=host, port=port, debug=debug, threaded=True)
