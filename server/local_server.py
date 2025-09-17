#!/usr/bin/env python3
"""
Local HTTP Server for Chrome Extension
Provides an endpoint to execute the remote proxy script
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import sys
import os
from urllib.parse import urlparse, parse_qs
import threading
import time

class ProxyScriptHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        """Handle POST requests to execute the script"""
        if self.path == '/execute-script':
            try:
                # Read request body
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                # Validate required fields
                required_fields = ['serverIp', 'password', 'proxyIpPort']
                if not all(field in data for field in required_fields):
                    self.send_error_response(400, 'Missing required fields')
                    return
                
                # Execute the Python script
                result = self.execute_proxy_script(
                    data['serverIp'],
                    data['password'],
                    data['proxyIpPort']
                )
                
                # Send response
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
                
            except json.JSONDecodeError:
                self.send_error_response(400, 'Invalid JSON data')
            except Exception as e:
                self.send_error_response(500, f'Server error: {str(e)}')
        else:
            self.send_error_response(404, 'Not found')

    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Remote Proxy Manager Server</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .status { padding: 20px; background: #e8f5e8; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>Remote Proxy Manager Server</h1>
                <div class="status">
                    <h2>Status: Running</h2>
                    <p>Server is ready to accept requests from the Chrome extension.</p>
                    <p><strong>Endpoint:</strong> POST /execute-script</p>
                </div>
                <h3>Usage:</h3>
                <pre>
POST /execute-script
Content-Type: application/json

{
  "serverIp": "192.168.1.100",
  "password": "your_password",
  "proxyIpPort": "proxy.example.com:8080"
}
                </pre>
            </body>
            </html>
            """
            self.wfile.write(html.encode('utf-8'))
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            health_data = {
                "status": "healthy",
                "timestamp": time.time()
            }
            self.wfile.write(json.dumps(health_data).encode('utf-8'))
        else:
            self.send_error_response(404, 'Not found')

    def execute_proxy_script(self, server_ip, password, proxy_ip_port):
        """Execute the Python proxy script"""
        try:
            # Get the directory of this script
            script_dir = os.path.dirname(os.path.abspath(__file__))
            python_script_path = os.path.join(script_dir, 'python_script.py')
            
            # Execute the script with arguments
            cmd = [
                sys.executable,
                python_script_path,
                '--target-ip', server_ip,
                '--password', password,
                '--proxy', proxy_ip_port
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            
            if result.returncode == 0:
                return result.stdout
            else:
                return f"Error: {result.stderr}"
                
        except subprocess.TimeoutExpired:
            return "Error: Script execution timeout"
        except FileNotFoundError:
            return "Error: Python script not found"
        except Exception as e:
            return f"Error: {str(e)}"

    def send_error_response(self, code, message):
        """Send an error response"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        error_data = {"error": message, "code": code}
        self.wfile.write(json.dumps(error_data).encode('utf-8'))

    def log_message(self, format, *args):
        """Override to customize logging"""
        print(f"[{self.address_string()}] {format % args}")

def run_server(port=8080):
    """Run the HTTP server"""
    server_address = ('localhost', port)
    httpd = HTTPServer(server_address, ProxyScriptHandler)
    
    print(f"Remote Proxy Manager Server starting on http://localhost:{port}")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Local server for Chrome extension')
    parser.add_argument('--port', type=int, default=8080, help='Port to run the server on')
    args = parser.parse_args()
    
    run_server(args.port)
