from flask import Flask, request, jsonify
from pypsrp.wsman import WSMan
from pypsrp.powershell import PowerShell, RunspacePool
import json
import logging
import os
from datetime import datetime
# Removed complex imports for simplicity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Simplified configuration - no API keys needed

def iana_to_windows_timezone(iana_timezone):
    """
    Convert IANA timezone name to Windows timezone ID
    Returns Windows timezone ID or None if not found
    """
    # Comprehensive mapping of IANA timezone names to Windows timezone IDs
    timezone_mapping = {
        # Americas
        "America/New_York": "Eastern Standard Time",
        "America/Chicago": "Central Standard Time",
        "America/Denver": "Mountain Standard Time",
        "America/Phoenix": "US Mountain Standard Time",
        "America/Los_Angeles": "Pacific Standard Time",
        "America/Anchorage": "Alaskan Standard Time",
        "America/Honolulu": "Hawaiian Standard Time",
        "America/Toronto": "Eastern Standard Time",
        "America/Vancouver": "Pacific Standard Time",
        "America/Mexico_City": "Central Standard Time (Mexico)",
        "America/Sao_Paulo": "E. South America Standard Time",
        "America/Buenos_Aires": "Argentina Standard Time",
        "America/Lima": "SA Pacific Standard Time",
        "America/Bogota": "SA Pacific Standard Time",
        "America/Santiago": "Pacific SA Standard Time",
        "America/Caracas": "Venezuela Standard Time",
        
        # Europe
        "Europe/London": "GMT Standard Time",
        "Europe/Paris": "W. Europe Standard Time",
        "Europe/Berlin": "W. Europe Standard Time",
        "Europe/Rome": "W. Europe Standard Time",
        "Europe/Madrid": "W. Europe Standard Time",
        "Europe/Amsterdam": "W. Europe Standard Time",
        "Europe/Brussels": "W. Europe Standard Time",
        "Europe/Vienna": "W. Europe Standard Time",
        "Europe/Prague": "Central Europe Standard Time",
        "Europe/Warsaw": "Central European Standard Time",
        "Europe/Budapest": "Central Europe Standard Time",
        "Europe/Athens": "GTB Standard Time",
        "Europe/Helsinki": "FLE Standard Time",
        "Europe/Stockholm": "W. Europe Standard Time",
        "Europe/Oslo": "W. Europe Standard Time",
        "Europe/Copenhagen": "W. Europe Standard Time",
        "Europe/Dublin": "GMT Standard Time",
        "Europe/Lisbon": "GMT Standard Time",
        "Europe/Moscow": "Russian Standard Time",
        "Europe/Kiev": "FLE Standard Time",
        "Europe/Istanbul": "Turkey Standard Time",
        
        # Asia
        "Asia/Dubai": "Arabian Standard Time",
        "Asia/Karachi": "Pakistan Standard Time",
        "Asia/Kolkata": "India Standard Time",
        "Asia/Dhaka": "Bangladesh Standard Time",
        "Asia/Bangkok": "SE Asia Standard Time",
        "Asia/Jakarta": "SE Asia Standard Time",
        "Asia/Manila": "Singapore Standard Time",
        "Asia/Hong_Kong": "China Standard Time",
        "Asia/Shanghai": "China Standard Time",
        "Asia/Tokyo": "Tokyo Standard Time",
        "Asia/Seoul": "Korea Standard Time",
        "Asia/Singapore": "Singapore Standard Time",
        "Asia/Kuala_Lumpur": "Singapore Standard Time",
        "Asia/Taipei": "Taipei Standard Time",
        "Asia/Jerusalem": "Israel Standard Time",
        "Asia/Riyadh": "Arab Standard Time",
        "Asia/Tehran": "Iran Standard Time",
        
        # Australia/Oceania
        "Australia/Sydney": "AUS Eastern Standard Time",
        "Australia/Melbourne": "AUS Eastern Standard Time",
        "Australia/Brisbane": "E. Australia Standard Time",
        "Australia/Perth": "W. Australia Standard Time",
        "Australia/Adelaide": "Cen. Australia Standard Time",
        "Pacific/Auckland": "New Zealand Standard Time",
        
        # Africa
        "Africa/Cairo": "Egypt Standard Time",
        "Africa/Johannesburg": "South Africa Standard Time",
        "Africa/Lagos": "W. Central Africa Standard Time",
        "Africa/Nairobi": "E. Africa Standard Time",
        
        # UTC
        "UTC": "UTC",
        "Etc/UTC": "UTC",
        "Etc/GMT": "UTC"
    }
    
    return timezone_mapping.get(iana_timezone)


def country_to_timezone(country_code):
    """
    Map country code to most common Windows timezone ID for that country
    Returns Windows timezone ID or None if not found
    """
    # Country code to most common timezone mapping
    country_timezone_mapping = {
        "US": "Eastern Standard Time",  # Most populous timezone
        "CA": "Eastern Standard Time",
        "MX": "Central Standard Time (Mexico)",
        "BR": "E. South America Standard Time",
        "AR": "Argentina Standard Time",
        "CL": "Pacific SA Standard Time",
        "CO": "SA Pacific Standard Time",
        "PE": "SA Pacific Standard Time",
        "VE": "Venezuela Standard Time",
        
        "GB": "GMT Standard Time",
        "IE": "GMT Standard Time",
        "PT": "GMT Standard Time",
        "FR": "W. Europe Standard Time",
        "DE": "W. Europe Standard Time",
        "IT": "W. Europe Standard Time",
        "ES": "W. Europe Standard Time",
        "NL": "W. Europe Standard Time",
        "BE": "W. Europe Standard Time",
        "AT": "W. Europe Standard Time",
        "CH": "W. Europe Standard Time",
        "SE": "W. Europe Standard Time",
        "NO": "W. Europe Standard Time",
        "DK": "W. Europe Standard Time",
        "FI": "FLE Standard Time",
        "PL": "Central European Standard Time",
        "CZ": "Central Europe Standard Time",
        "HU": "Central Europe Standard Time",
        "GR": "GTB Standard Time",
        "TR": "Turkey Standard Time",
        "RU": "Russian Standard Time",
        "UA": "FLE Standard Time",
        
        "IN": "India Standard Time",
        "PK": "Pakistan Standard Time",
        "BD": "Bangladesh Standard Time",
        "TH": "SE Asia Standard Time",
        "ID": "SE Asia Standard Time",
        "PH": "Singapore Standard Time",
        "SG": "Singapore Standard Time",
        "MY": "Singapore Standard Time",
        "CN": "China Standard Time",
        "HK": "China Standard Time",
        "TW": "Taipei Standard Time",
        "JP": "Tokyo Standard Time",
        "KR": "Korea Standard Time",
        "VN": "SE Asia Standard Time",
        "IL": "Israel Standard Time",
        "SA": "Arab Standard Time",
        "AE": "Arabian Standard Time",
        "IR": "Iran Standard Time",
        
        "AU": "AUS Eastern Standard Time",
        "NZ": "New Zealand Standard Time",
        
        "EG": "Egypt Standard Time",
        "ZA": "South Africa Standard Time",
        "NG": "W. Central Africa Standard Time",
        "KE": "E. Africa Standard Time",
    }
    
    return country_timezone_mapping.get(country_code.upper() if country_code else None)


def get_timezone_utc_offset_minutes(iana_timezone):
    """
    Get UTC offset in minutes for a given IANA timezone
    This is a simplified approximation - for production, use a proper timezone library
    Returns offset in minutes (positive for ahead of UTC, negative for behind)
    """
    # Common UTC offsets for major timezones (approximate, not accounting for DST)
    # This is a simplified mapping - in production, use pytz or similar
    offset_mapping = {
        "America/New_York": -300,  # UTC-5
        "America/Chicago": -360,    # UTC-6
        "America/Denver": -420,     # UTC-7
        "America/Los_Angeles": -480, # UTC-8
        "America/Anchorage": -540,  # UTC-9
        "America/Honolulu": -600,   # UTC-10
        "Europe/London": 0,         # UTC+0
        "Europe/Paris": 60,         # UTC+1
        "Europe/Berlin": 60,        # UTC+1
        "Europe/Moscow": 180,       # UTC+3
        "Asia/Dubai": 240,          # UTC+4
        "Asia/Karachi": 300,        # UTC+5
        "Asia/Kolkata": 330,        # UTC+5:30
        "Asia/Dhaka": 360,          # UTC+6
        "Asia/Bangkok": 420,        # UTC+7
        "Asia/Hong_Kong": 480,      # UTC+8
        "Asia/Tokyo": 540,          # UTC+9
        "Asia/Seoul": 540,          # UTC+9
        "Australia/Sydney": 600,    # UTC+10
        "Pacific/Auckland": 720,    # UTC+12
    }
    
    return offset_mapping.get(iana_timezone, 0)


def execute_powershell_script(target_ip, password, proxy_ip_port, browser_timezone=None, utc_offset=None):
    """
    Execute the PowerShell script to configure proxy, get public IP information, and sync timezone.
    Timezone is primarily determined from ipinfo.io API response, with fallback to country-based
    timezone or browser timezone if ipinfo timezone is unavailable.
    """
    try:
        logger.info(f"Connecting to {target_ip} with proxy {proxy_ip_port}")
        if browser_timezone:
            logger.info(f"Browser timezone: {browser_timezone}, UTC offset: {utc_offset}")
        
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

        # Step 1: Set proxy and get public IP, ISP, country, and timezone
        ps.add_script(f'''
# Set system-wide and current user proxy
Set-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyEnable -Value 1
Set-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyServer -Value "{proxy_ip_port}"
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyEnable -Value 1
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" ProxyServer -Value "{proxy_ip_port}"

# Get public IP, ISP, country, and timezone
$response = Invoke-WebRequest -Uri "https://ipinfo.io/json" -UseBasicParsing
$data = $response.Content | ConvertFrom-Json
$data.ip
$data.org
$data.country
$data.timezone
''')

        output = ps.invoke()
        
        if not output or len(output) < 3:
            pool.close()
            return {
                "status": "Connection Failed",
                "target_ip": target_ip,
                "proxy": proxy_ip_port,
                "timestamp": datetime.now().isoformat()
            }

        public_ip = output[0].strip()
        isp = output[1].strip()
        country = output[2].strip()
        # Get timezone from ipinfo.io (4th output, may be None if not available)
        ipinfo_timezone = output[3].strip() if len(output) >= 4 and output[3] else None
        if ipinfo_timezone:
            logger.info(f"ipinfo.io timezone: {ipinfo_timezone}")
        else:
            logger.info("ipinfo.io timezone not available")

        # Initialize timezone variables
        current_timezone = None
        target_timezone = None
        new_timezone = None
        timezone_changed = False
        timezone_sync_status = "Not attempted"

        # Step 2: Timezone synchronization (only if proxy is active)
        if public_ip != target_ip:
            try:
                # Get current system timezone
                ps2 = PowerShell(pool)
                ps2.add_script('Get-TimeZone | Select-Object -ExpandProperty Id')
                tz_output = ps2.invoke()
                if tz_output:
                    current_timezone = tz_output[0].strip()
                    logger.info(f"Current system timezone: {current_timezone}")

                # Determine target timezone - use ipinfo timezone as primary source
                if ipinfo_timezone:
                    # Convert IANA timezone from ipinfo to Windows timezone
                    target_timezone = iana_to_windows_timezone(ipinfo_timezone)
                    if target_timezone:
                        timezone_sync_status = f"Using ipinfo timezone: {ipinfo_timezone}"
                        logger.info(f"ipinfo timezone: {ipinfo_timezone} -> Windows timezone: {target_timezone}")
                    else:
                        # Fallback to country-based timezone if IANA conversion fails
                        target_timezone = country_to_timezone(country)
                        if target_timezone:
                            timezone_sync_status = f"ipinfo timezone not mapped, using country default: {country}"
                            logger.info(f"ipinfo timezone {ipinfo_timezone} not in mapping, using country {country} -> {target_timezone}")
                        else:
                            timezone_sync_status = f"Could not determine timezone from ipinfo ({ipinfo_timezone}) or country ({country})"
                            logger.warning(f"Could not map timezone: ipinfo={ipinfo_timezone}, country={country}")
                else:
                    # Fallback to country-based timezone if ipinfo doesn't provide timezone
                    target_timezone = country_to_timezone(country)
                    if target_timezone:
                        timezone_sync_status = f"ipinfo timezone not available, using country default: {country}"
                        logger.info(f"ipinfo timezone not available, using country {country} -> {target_timezone}")
                    else:
                        # Last resort: use browser timezone if provided
                        if browser_timezone:
                            target_timezone = iana_to_windows_timezone(browser_timezone)
                            if target_timezone:
                                timezone_sync_status = f"Using browser timezone as fallback: {browser_timezone}"
                                logger.info(f"Using browser timezone fallback: {browser_timezone} -> {target_timezone}")
                            else:
                                timezone_sync_status = "Could not determine timezone from any source"
                                logger.warning("Could not determine timezone from ipinfo, country, or browser")
                        else:
                            timezone_sync_status = "Could not determine timezone (ipinfo unavailable, no browser timezone)"
                            logger.warning("Could not determine timezone: ipinfo unavailable and no browser timezone provided")
                
                # Set timezone if different from current
                if target_timezone and current_timezone != target_timezone:
                    logger.info(f"Changing timezone from {current_timezone} to {target_timezone}")
                    ps3 = PowerShell(pool)
                    ps3.add_script(f'Set-TimeZone -Id "{target_timezone}"')
                    ps3.invoke()
                    
                    # Verify timezone was set
                    ps4 = PowerShell(pool)
                    ps4.add_script('Get-TimeZone | Select-Object -ExpandProperty Id')
                    verify_output = ps4.invoke()
                    if verify_output:
                        new_timezone = verify_output[0].strip()
                        timezone_changed = (new_timezone == target_timezone)
                        if timezone_changed:
                            timezone_sync_status = "Timezone changed successfully"
                        else:
                            timezone_sync_status = f"Timezone change attempted (current: {new_timezone})"
                else:
                    new_timezone = current_timezone
                    if current_timezone == target_timezone:
                        timezone_sync_status = "Timezone already correct"
                    else:
                        timezone_sync_status = "Timezone change skipped (no target timezone)"
                        
            except Exception as tz_error:
                logger.warning(f"Timezone synchronization error: {str(tz_error)}")
                timezone_sync_status = f"Timezone sync error: {str(tz_error)}"

        pool.close()

        # Build result
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
                "timestamp": datetime.now().isoformat(),
                "timezone": {
                    "current": current_timezone,
                    "target": target_timezone,
                    "new": new_timezone,
                    "changed": timezone_changed,
                    "sync_status": timezone_sync_status,
                    "ipinfo_timezone": ipinfo_timezone,
                    "browser_timezone": browser_timezone
                }
            }

        return result

    except Exception as e:
        logger.error(f"Error executing PowerShell script: {str(e)}")
        raise Exception(f"Script execution failed: {str(e)}")

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
        
        # Extract optional timezone fields
        browser_timezone = data.get('browserTimezone')
        utc_offset = data.get('utcOffset')

        # Validate required fields
        if not all([target_ip, password, proxy_ip_port]):
            return jsonify({
                "success": False,
                "error": "Missing required fields: serverIp, password, proxyIpPort"
            }), 400

        logger.info(f"Received request for target_ip: {target_ip}, proxy: {proxy_ip_port}")
        if browser_timezone:
            logger.info(f"Browser timezone: {browser_timezone}, UTC offset: {utc_offset}")

        # Execute the PowerShell script with timezone parameters
        result = execute_powershell_script(target_ip, password, proxy_ip_port, browser_timezone, utc_offset)

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
        output = f"""Public IP: {result['public_ip']}
ISP: {result['isp']}
Country: {result['country']}
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: {result['status']}"""
        
        # Add timezone information if available
        if "timezone" in result and result["timezone"]:
            tz = result["timezone"]
            output += f"""

Timezone Information:
IPInfo Timezone: {tz.get('ipinfo_timezone', 'N/A')}
Current Timezone: {tz.get('current', 'N/A')}
Target Timezone: {tz.get('target', 'N/A')}
New Timezone: {tz.get('new', 'N/A')}
Sync Status: {tz.get('sync_status', 'N/A')}"""
            if tz.get('browser_timezone'):
                output += f"\nBrowser Timezone (fallback): {tz.get('browser_timezone', 'N/A')}"
            if tz.get('changed'):
                output += "\n✓ Timezone was changed successfully"
        
        return output
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
            "GET /api/health": "Health check endpoint"
        },
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    # For development
    app.run(host='0.0.0.0', port=5000, debug=True)
    
    # For production, use a WSGI server like gunicorn:
    # gunicorn -w 4 -b 0.0.0.0:5000 app:app