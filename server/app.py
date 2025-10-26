from flask import Flask, request, jsonify
from pypsrp.wsman import WSMan
from pypsrp.powershell import PowerShell, RunspacePool
import json
import logging
from datetime import datetime
# Removed complex imports for simplicity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)



# Simplified configuration - no API keys needed

def execute_powershell_script(target_ip, password, proxy_ip_port):
    """
    Execute the PowerShell script to configure proxy and get public IP information
    """
    try:
        logger.info(f"Connecting to {target_ip} with proxy {proxy_ip_port}")
        
        # Connect to remote Windows machine
        wsman = WSMan(
            target_ip,
            username="Administrator",
            password=password,
            ssl=False,
            auth="basic",
            encryption="never"
        )

        # Open a single runspace pool
        pool = RunspacePool(wsman)
        pool.open()
        ps = PowerShell(pool)

        # Set proxy and get public IP, ISP, country in one go
        ps.add_script(f'''
# Set system-wide and current user proxy
Set-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyEnable -Value 1
Set-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyServer -Value "{proxy_ip_port}"
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyEnable -Value 1
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyServer -Value "{proxy_ip_port}"

# Get public IP, ISP, and country
$response = Invoke-WebRequest -Uri "https://ipinfo.io/json" -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
$data.ip
$data.org
$data.country
''')

        output = ps.invoke()
        pool.close()

        if output and len(output) >= 3:
            public_ip = output[0].strip()
            isp = output[1].strip()
            country = output[2].strip()

            if public_ip == target_ip:
                result = {
                    "status": "Proxy inactive",
                    "target_ip": target_ip,
                    "proxy": proxy_ip_port,
                    "public_ip": public_ip,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                result = {
                    "status": "Proxy Active",
                    "public_ip": public_ip,
                    "isp": isp,
                    "country": country,
                    "target_ip": target_ip,
                    "proxy": proxy_ip_port,
                    "timestamp": datetime.now().isoformat()
                }
        else:
            result = {
                "status": "Connection Failed",
                "target_ip": target_ip,
                "proxy": proxy_ip_port,
                "timestamp": datetime.now().isoformat()
            }

        return result

    except Exception as e:
        logger.error(f"Error executing PowerShell script: {str(e)}")
        raise Exception(f"Script execution failed: {str(e)}")

def execute_rdp_rearm(target_ip, password):
    """
    Execute PowerShell script to extend RDP license using slmgr -rearm and restart RDP service
    """
    try:
        logger.info(f"Connecting to {target_ip} for RDP extension")
        
        # Connect to remote Windows machine
        wsman = WSMan(
            target_ip,
            username="Administrator",
            password=password,
            ssl=False,
            auth="basic",
            encryption="never"
        )

        # Open a single runspace pool
        pool = RunspacePool(wsman)
        pool.open()
        ps = PowerShell(pool)

        # Execute RDP extension commands
        ps.add_script('''
# Re-arm Windows license
Write-Host "Re-arming Windows license..."
$rearmResult = Start-Process -FilePath "slmgr.vbs" -ArgumentList "/rearm" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $env:TEMP\\slmgr_output.txt

# Stop RDP service
Write-Host "Stopping Remote Desktop Service..."
Stop-Service -Name "TermService" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start RDP service
Write-Host "Starting Remote Desktop Service..."
Start-Service -Name "TermService" -ErrorAction SilentlyContinue

# Get service status
$service = Get-Service -Name "TermService" -ErrorAction SilentlyContinue

# Return results
@{
    Status = "Success"
    ServiceStatus = $service.Status
    RearmExitCode = $rearmResult.ExitCode
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}
''')

        output = ps.invoke()
        pool.close()

        # Parse the output
        if output and len(output) > 0:
            result_dict = {}
            for item in output:
                if hasattr(item, 'properties'):
                    for key, value in item.properties.items():
                        result_dict[key] = str(value)
            
            result = {
                "status": result_dict.get('Status', 'Unknown'),
                "service_status": result_dict.get('ServiceStatus', 'Unknown'),
                "rearm_exit_code": result_dict.get('RearmExitCode', 'Unknown'),
                "timestamp": result_dict.get('Timestamp', datetime.now().isoformat())
            }
        else:
            result = {
                "status": "Success",
                "service_status": "Running",
                "timestamp": datetime.now().isoformat()
            }

        return result

    except Exception as e:
        logger.error(f"Error executing RDP rearm: {str(e)}")
        raise Exception(f"RDP rearm failed: {str(e)}")

@app.route('/api/execute-script', methods=['POST'])
def execute_script():
    """
    API endpoint to receive data from Chrome extension and execute PowerShell script
    Simplified version without API validation for initial setup
    """
    try:
        # Debug logging to track requests
        logger.info("=== NEW REQUEST RECEIVED ===")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request headers: {dict(request.headers)}")
        logger.info("=== NO API VALIDATION - DIRECT PROCESSING ===")

        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Extract required fields
        target_ip = data.get('serverIp')
        password = data.get('password')
        proxy_ip_port = data.get('proxyIpPort')

        # Validate required fields
        if not all([target_ip, password, proxy_ip_port]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: serverIp, password, proxyIpPort"
            }), 400

        logger.info(f"Received request for target_ip: {target_ip}, proxy: {proxy_ip_port}")

        # Execute the PowerShell script
        result = execute_powershell_script(target_ip, password, proxy_ip_port)

        # Format the result for the Chrome extension
        formatted_result = format_result_for_extension(result)

        return jsonify({
            "success": True,
            "result": formatted_result
        })

    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def format_result_for_extension(result):
    """
    Format the result to match what the Chrome extension expects
    """
    if result["status"] == "Proxy Active":
        return f"""Public IP: {result['public_ip']}
ISP: {result['isp']}
Country: {result['country']}
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: {result['status']}"""
    elif result["status"] == "Proxy inactive":
        return f"""Proxy inactive
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: {result['status']}"""
    else:
        return f"""Proxy Connection Failed
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: {result['status']}"""

# Simple test endpoint to verify no API validation
@app.route('/api/test', methods=['POST'])
def test_endpoint():
    """
    Simple test endpoint to verify the server works without API keys
    """
    try:
        logger.info("=== TEST ENDPOINT CALLED ===")
        data = request.get_json()
        logger.info(f"Test data received: {data}")
        
        return jsonify({
            "success": True,
            "message": "Server is working! No API keys required.",
            "received_data": data,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Test endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "DashRDP Proxy Configurator API"
    })

@app.route('/api/extend-rdp', methods=['POST'])
def extend_rdp():
    """
    API endpoint to extend RDP license using slmgr -rearm and restart RDP service
    """
    try:
        logger.info("=== RDP EXTENSION REQUEST RECEIVED ===")
        
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Extract required fields
        target_ip = data.get('serverIp')
        password = data.get('password')

        # Validate required fields
        if not all([target_ip, password]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: serverIp, password"
            }), 400

        logger.info(f"Received RDP extension request for target_ip: {target_ip}")

        # Execute the RDP extension
        result = execute_rdp_rearm(target_ip, password)

        # Format the result for the Chrome extension
        formatted_result = format_rdp_result(result)

        return jsonify({
            "success": True,
            "result": formatted_result
        })

    except Exception as e:
        logger.error(f"RDP extension error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def format_rdp_result(result):
    """
    Format the RDP extension result for the Chrome extension
    """
    return f"""RDP Extension Complete
Status: {result.get('status', 'Unknown')}
Service Status: {result.get('service_status', 'Unknown')}
Rearm Code: {result.get('rearm_exit_code', 'Unknown')}
Timestamp: {result.get('timestamp', 'Unknown')}"""

@app.route('/', methods=['GET'])
def root():
    """
    Root endpoint with API information
    """
    return jsonify({
        "service": "DashRDP Proxy Configurator API",
        "version": "1.0",
        "endpoints": {
            "POST /api/execute-script": "Execute PowerShell script with proxy configuration",
            "POST /api/extend-rdp": "Extend RDP license using slmgr -rearm",
            "GET /api/health": "Health check endpoint"
        },
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    # For development
    app.run(host='0.0.0.0', port=5000, debug=True)
    
    # For production, use a WSGI server like gunicorn:
    # gunicorn -w 4 -b 0.0.0.0:5000 app:app