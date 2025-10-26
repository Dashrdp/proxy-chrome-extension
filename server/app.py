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

def check_rdp_license_status(target_ip, password):
    """
    Check the RDP license status and remaining days
    """
    try:
        logger.info(f"Checking RDP license status for {target_ip}")
        
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

        # Check license status
        ps.add_script('''
# Get license expiration information
$licenseStatus = cscript //nologo C:\\Windows\\System32\\slmgr.vbs /dli 2>&1 | Out-String

# Get grace period remaining
$graceStatus = cscript //nologo C:\\Windows\\System32\\slmgr.vbs /xpr 2>&1 | Out-String

# Parse to find remaining days
$remainingDays = -1
$isExpired = $false
$needsRearm = $false

# Try multiple patterns to extract days
if ($graceStatus -match "(\\d+)\\s+day") {
    $remainingDays = [int]$matches[1]
} elseif ($graceStatus -match "expired" -or $graceStatus -match "Notification mode") {
    $isExpired = $true
    $needsRearm = $true
    $remainingDays = 0
}

# Check license status for other indicators
if ($licenseStatus -match "Notification mode" -or $licenseStatus -match "expired") {
    $isExpired = $true
    $needsRearm = $true
    $remainingDays = 0
}

# If we couldn't determine days, assume we need to rearm
if ($remainingDays -eq -1) {
    $needsRearm = $true
}

# Output results
Write-Output "LICENSE_STATUS:$licenseStatus"
Write-Output "GRACE_STATUS:$graceStatus"
Write-Output "REMAINING_DAYS:$remainingDays"
Write-Output "IS_EXPIRED:$isExpired"
Write-Output "NEEDS_REARM:$needsRearm"
''')

        output = ps.invoke()
        pool.close()

        # Parse the output
        license_status = ""
        grace_status = ""
        remaining_days = -1
        is_expired = False
        needs_rearm = False

        if output:
            for line in output:
                line_str = str(line).strip()
                if line_str.startswith("LICENSE_STATUS:"):
                    license_status = line_str.replace("LICENSE_STATUS:", "")
                elif line_str.startswith("GRACE_STATUS:"):
                    grace_status = line_str.replace("GRACE_STATUS:", "")
                elif line_str.startswith("REMAINING_DAYS:"):
                    try:
                        remaining_days = int(line_str.replace("REMAINING_DAYS:", ""))
                    except:
                        remaining_days = -1
                elif line_str.startswith("IS_EXPIRED:"):
                    is_expired = line_str.replace("IS_EXPIRED:", "").lower() == "true"
                elif line_str.startswith("NEEDS_REARM:"):
                    needs_rearm = line_str.replace("NEEDS_REARM:", "").lower() == "true"

        # Additional logic: if remaining days is unknown (-1) or in notification mode, needs rearm
        if remaining_days == -1 or "notification mode" in grace_status.lower() or "notification mode" in license_status.lower():
            needs_rearm = True
            is_expired = True

        result = {
            "license_status": license_status,
            "grace_status": grace_status,
            "remaining_days": remaining_days,
            "is_expired": is_expired,
            "needs_rearm": needs_rearm,
            "timestamp": datetime.now().isoformat()
        }

        return result

    except Exception as e:
        logger.error(f"Error checking RDP license: {str(e)}")
        raise Exception(f"License check failed: {str(e)}")

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

        # Execute RDP extension commands with detailed output
        ps.add_script('''
# Get initial service status
$initialService = Get-Service -Name "TermService" -ErrorAction SilentlyContinue
$initialStatus = $initialService.Status

Write-Output "INITIAL_SERVICE_STATUS:$initialStatus"

# Execute slmgr rearm - Run directly without Start-Process
Write-Output "REARM_START:Executing slmgr /rearm"
try {
    # Method 1: Direct execution with cscript
    $rearmOutput = & cscript.exe //nologo C:\Windows\System32\slmgr.vbs /rearm 2>&1
    $rearmExitCode = $LASTEXITCODE
    
    Write-Output "REARM_OUTPUT:$rearmOutput"
    Write-Output "REARM_EXIT_CODE:$rearmExitCode"
    
    if ($rearmExitCode -eq 0 -or $rearmOutput -like "*success*" -or $rearmOutput -like "*completed*") {
        Write-Output "REARM_STATUS:Success - Rearm executed"
    } else {
        Write-Output "REARM_STATUS:Completed with code $rearmExitCode"
    }
    
    # Wait a moment for rearm to take effect
    Start-Sleep -Seconds 2
} catch {
    Write-Output "REARM_STATUS:Error - $($_.Exception.Message)"
    Write-Output "REARM_EXIT_CODE:-1"
    
    # Try alternative method
    Write-Output "REARM_RETRY:Trying alternative method"
    try {
        slmgr.vbs /rearm
        Write-Output "REARM_STATUS:Alternative method executed"
    } catch {
        Write-Output "REARM_RETRY_ERROR:$($_.Exception.Message)"
    }
}

# SERVER REBOOT - Restart entire server for rearm to take effect
Write-Output "SERVER_REBOOT:Initiating full server reboot"
Write-Output "SERVER_REBOOT:Note - Server will be offline for 2-3 minutes"

try {
    # Schedule a reboot in 10 seconds to allow script to complete and return results
    Write-Output "SERVER_REBOOT:Scheduling reboot in 10 seconds"
    
    # Use shutdown command to restart
    $rebootResult = & shutdown /r /t 10 /c "Rebooting server after Windows license rearm" /f 2>&1
    Write-Output "REBOOT_SCHEDULED:$rebootResult"
    
    Write-Output "REBOOT_STATUS:Server reboot scheduled successfully"
    Write-Output "REBOOT_TIME:Server will restart in 10 seconds"
    
} catch {
    Write-Output "REBOOT_ERROR:$($_.Exception.Message)"
    
    # Try alternative method
    Write-Output "REBOOT_RETRY:Trying Restart-Computer method"
    try {
        # Schedule restart
        Restart-Computer -Force -Delay 10 -ErrorAction Stop
        Write-Output "REBOOT_STATUS:Server reboot initiated via Restart-Computer"
    } catch {
        Write-Output "REBOOT_RETRY_ERROR:$($_.Exception.Message)"
        
        # Last resort - direct shutdown command
        Write-Output "REBOOT_LAST_RESORT:Using direct shutdown.exe"
        & shutdown.exe -r -t 10 -f
        Write-Output "REBOOT_STATUS:Direct shutdown command executed"
    }
}

Write-Output "REBOOT_COMPLETE:Reboot command executed, server will restart shortly"

Write-Output "OPERATION_COMPLETE:Rearm and reboot commands executed"
Write-Output "SERVER_REBOOT_NOTE:Server is now rebooting, connection will be lost"
Write-Output "SERVER_REBOOT_NOTE:Server will be back online in approximately 2-3 minutes"
Write-Output "SERVER_REBOOT_NOTE:Please wait 2-3 minutes then use CHECK LICENSE button to verify"
''')

        output = ps.invoke()
        pool.close()

        # Parse the detailed output
        result = {
            "initial_service_status": "Unknown",
            "rearm_status": "Unknown",
            "rearm_output": "Unknown",
            "rearm_exit_code": "Unknown",
            "reboot_status": "Unknown",
            "reboot_time": "Unknown",
            "reboot_scheduled": "Unknown",
            "server_reboot_notes": [],
            "raw_output": [],
            "timestamp": datetime.now().isoformat()
        }

        if output:
            for line in output:
                line_str = str(line).strip()
                result["raw_output"].append(line_str)
                
                if line_str.startswith("INITIAL_SERVICE_STATUS:"):
                    result["initial_service_status"] = line_str.replace("INITIAL_SERVICE_STATUS:", "")
                elif line_str.startswith("REARM_STATUS:"):
                    result["rearm_status"] = line_str.replace("REARM_STATUS:", "")
                elif line_str.startswith("REARM_OUTPUT:"):
                    result["rearm_output"] = line_str.replace("REARM_OUTPUT:", "")
                elif line_str.startswith("REARM_EXIT_CODE:"):
                    result["rearm_exit_code"] = line_str.replace("REARM_EXIT_CODE:", "")
                elif line_str.startswith("REBOOT_STATUS:"):
                    result["reboot_status"] = line_str.replace("REBOOT_STATUS:", "")
                elif line_str.startswith("REBOOT_TIME:"):
                    result["reboot_time"] = line_str.replace("REBOOT_TIME:", "")
                elif line_str.startswith("REBOOT_SCHEDULED:"):
                    result["reboot_scheduled"] = line_str.replace("REBOOT_SCHEDULED:", "")
                elif line_str.startswith("SERVER_REBOOT_NOTE:"):
                    result["server_reboot_notes"].append(line_str.replace("SERVER_REBOOT_NOTE:", ""))

        logger.info(f"RDP rearm result: {result}")
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

@app.route('/api/check-rdp-license', methods=['POST'])
def check_rdp_license():
    """
    API endpoint to check RDP license status and remaining days
    """
    try:
        logger.info("=== RDP LICENSE CHECK REQUEST RECEIVED ===")
        
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

        logger.info(f"Checking RDP license for target_ip: {target_ip}")

        # Check the license status
        result = check_rdp_license_status(target_ip, password)

        # Format the result for the Chrome extension
        formatted_result = format_license_check_result(result)

        return jsonify({
            "success": True,
            "result": formatted_result,
            "remaining_days": result.get('remaining_days', -1),
            "is_expired": result.get('is_expired', False),
            "needs_rearm": result.get('needs_rearm', False)
        })

    except Exception as e:
        logger.error(f"RDP license check error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/extend-rdp', methods=['POST'])
def extend_rdp():
    """
    API endpoint to extend RDP license using slmgr -rearm and restart RDP service
    This endpoint now checks license status first and only rearms if expired
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
        force_rearm = data.get('forceRearm', False)  # Optional flag to force rearm

        # Validate required fields
        if not all([target_ip, password]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: serverIp, password"
            }), 400

        logger.info(f"Received RDP extension request for target_ip: {target_ip}")

        # First, check the license status
        license_result = check_rdp_license_status(target_ip, password)
        remaining_days = license_result.get('remaining_days', -1)
        is_expired = license_result.get('is_expired', False)
        needs_rearm = license_result.get('needs_rearm', False)

        logger.info(f"License check - Remaining days: {remaining_days}, Is expired: {is_expired}, Needs rearm: {needs_rearm}")

        # Rearm if:
        # 1. License is expired or in notification mode
        # 2. Remaining days is unknown (-1)
        # 3. Remaining days is less than 30
        # 4. Force rearm flag is set
        should_rearm = (
            force_rearm or 
            needs_rearm or 
            is_expired or 
            remaining_days == -1 or 
            (remaining_days >= 0 and remaining_days < 30)
        )

        if should_rearm:
            reason = []
            if force_rearm:
                reason.append("Force rearm requested")
            if needs_rearm:
                reason.append("License needs rearm")
            if is_expired:
                reason.append("License expired")
            if remaining_days == -1:
                reason.append("Cannot determine remaining days")
            if remaining_days >= 0 and remaining_days < 30:
                reason.append(f"Less than 30 days remaining ({remaining_days} days)")
            
            logger.info(f"Proceeding with rearm. Reasons: {', '.join(reason)}")
            
            # Execute the RDP extension
            rearm_result = execute_rdp_rearm(target_ip, password)

            # Format the result for the Chrome extension
            formatted_result = format_rdp_result(rearm_result, license_result)

            return jsonify({
                "success": True,
                "result": formatted_result,
                "action_taken": "rearm_executed",
                "previous_remaining_days": remaining_days,
                "rearm_reason": ', '.join(reason)
            })
        else:
            logger.info(f"License is still valid ({remaining_days} days remaining). No rearm needed.")
            
            # Format the result showing license is still valid
            formatted_result = format_license_valid_result(license_result)

            return jsonify({
                "success": True,
                "result": formatted_result,
                "action_taken": "no_action_needed",
                "remaining_days": remaining_days
            })

    except Exception as e:
        logger.error(f"RDP extension error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def format_license_check_result(result):
    """
    Format the license check result for the Chrome extension
    """
    remaining_days = result.get('remaining_days', -1)
    is_expired = result.get('is_expired', False)
    needs_rearm = result.get('needs_rearm', False)
    grace_status = result.get('grace_status', 'Unknown')
    
    # Determine status based on multiple factors
    if is_expired or remaining_days == 0 or needs_rearm:
        status_text = "⚠️ LICENSE EXPIRED / NEEDS REARM"
    elif remaining_days == -1:
        status_text = "⚠️ LICENSE STATUS UNKNOWN - WILL REARM"
    elif remaining_days > 0 and remaining_days < 30:
        status_text = f"⚠️ LICENSE EXPIRING SOON ({remaining_days} days)"
    elif remaining_days >= 30:
        status_text = f"✅ LICENSE ACTIVE"
    else:
        status_text = "ℹ️ LICENSE STATUS UNKNOWN"
    
    days_display = remaining_days if remaining_days >= 0 else 'Unknown'
    
    return f"""{status_text}
Remaining Days: {days_display}
Grace Status: {grace_status}
Action Required: {'Yes - Will rearm' if (needs_rearm or remaining_days == -1 or (remaining_days >= 0 and remaining_days < 30)) else 'No'}
Timestamp: {result.get('timestamp', 'Unknown')}"""

def format_rdp_result(rearm_result, license_result=None):
    """
    Format the RDP extension result for the Chrome extension
    """
    # Get detailed status
    rearm_status = rearm_result.get('rearm_status', 'Unknown')
    rearm_output = rearm_result.get('rearm_output', 'Unknown')
    rearm_exit_code = rearm_result.get('rearm_exit_code', 'Unknown')
    reboot_status = rearm_result.get('reboot_status', 'Unknown')
    reboot_time = rearm_result.get('reboot_time', 'Unknown')
    reboot_notes = rearm_result.get('server_reboot_notes', [])
    raw_output = rearm_result.get('raw_output', [])
    
    # Determine overall success
    overall_status = "✅ REARM SUCCESSFUL - SERVER REBOOTING" if (
        rearm_exit_code == "0" and 
        reboot_status != "Unknown"
    ) else "⚠️ PARTIAL SUCCESS" if rearm_status != "Unknown" else "❌ FAILED"
    
    result_text = f"""RDP Extension Complete
{overall_status}

━━━ REARM OPERATION ━━━
Status: {rearm_status}
Output: {rearm_output}
Exit Code: {rearm_exit_code}

━━━ SERVER REBOOT ━━━
Status: {reboot_status}
Timing: {reboot_time}

⚠️ IMPORTANT NOTES:
{chr(10).join([f"  • {note}" for note in reboot_notes]) if reboot_notes else "  • Server is rebooting"}

━━━ NEXT STEPS ━━━
1. Wait 2-3 minutes for server to reboot
2. Server will come back online automatically
3. Click "EXTEND RDP LICENSE" again to verify license

Timestamp: {rearm_result.get('timestamp', 'Unknown')}"""

    if license_result:
        prev_days = license_result.get('remaining_days', 'Unknown')
        result_text += f"""

━━━ SUMMARY ━━━
Previous Days: {prev_days}
Action Taken: Rearm executed and server rebooting"""

    return result_text

def format_license_valid_result(result):
    """
    Format the result when license is still valid
    """
    remaining_days = result.get('remaining_days', -1)
    grace_status = result.get('grace_status', 'Unknown')
    
    return f"""✅ RDP License Still Valid
Remaining Days: {remaining_days}
Grace Status: {grace_status}
Action: No rearm needed
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
            "POST /api/check-rdp-license": "Check RDP license status and remaining days",
            "POST /api/extend-rdp": "Check license and extend RDP using slmgr -rearm if expired",
            "GET /api/health": "Health check endpoint"
        },
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    # For development
    app.run(host='0.0.0.0', port=5000, debug=True)
    
    # For production, use a WSGI server like gunicorn:
    # gunicorn -w 4 -b 0.0.0.0:5000 app:app