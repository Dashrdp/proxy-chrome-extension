#!/usr/bin/env python3
"""
Remote Proxy Manager Script
Connects to a remote Windows machine and configures proxy settings
"""

from pypsrp.wsman import WSMan
from pypsrp.powershell import PowerShell, RunspacePool
import json
import sys
import argparse
from typing import Dict, Any

def execute_remote_proxy_script(target_ip: str, password: str, proxy_ip_port: str) -> Dict[str, Any]:
    """
    Execute the remote proxy configuration script
    
    Args:
        target_ip: Target server IP address
        password: Administrator password
        proxy_ip_port: Proxy server in format IP:Port
    
    Returns:
        Dictionary containing the results
    """
    username = "Administrator"
    
    try:
        # Connect to remote Windows machine
        wsman = WSMan(
            target_ip,
            username=username,
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
            public_ip = str(output[0]).strip()
            isp = str(output[1]).strip()
            country = str(output[2]).strip()

            if public_ip == target_ip:
                return {
                    "status": "inactive",
                    "message": "Proxy inactive",
                    "target_ip": target_ip,
                    "proxy": proxy_ip_port
                }
            else:
                return {
                    "status": "active",
                    "public_ip": public_ip,
                    "isp": isp,
                    "country": country,
                    "target_ip": target_ip,
                    "proxy": proxy_ip_port
                }
        else:
            return {
                "status": "failed",
                "message": "Proxy Connection Failed",
                "target_ip": target_ip,
                "proxy": proxy_ip_port
            }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Connection error: {str(e)}",
            "target_ip": target_ip,
            "proxy": proxy_ip_port
        }

def format_output(result: Dict[str, Any]) -> str:
    """Format the result for display"""
    if result["status"] == "active":
        return f"""Public IP: {result['public_ip']}
ISP: {result['isp']}
Country: {result['country']}
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: Proxy Active"""
    elif result["status"] == "inactive":
        return f"""Proxy inactive
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: Proxy Inactive"""
    elif result["status"] == "failed":
        return f"""Proxy Connection Failed
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: Connection Failed"""
    else:
        return f"""Error: {result['message']}
Target IP: {result['target_ip']}
Proxy: {result['proxy']}
Status: Error"""

def main():
    """Main function for command line execution"""
    parser = argparse.ArgumentParser(description='Remote Proxy Manager')
    parser.add_argument('--target-ip', required=True, help='Target server IP address')
    parser.add_argument('--password', required=True, help='Administrator password')
    parser.add_argument('--proxy', required=True, help='Proxy server in format IP:Port')
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    
    args = parser.parse_args()
    
    result = execute_remote_proxy_script(args.target_ip, args.password, args.proxy)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(format_output(result))

if __name__ == "__main__":
    # Check if running from command line or as a module
    if len(sys.argv) > 1:
        main()
    else:
        # Interactive mode
        target_ip = input("Enter the target IP: ")
        password = input("Enter the password: ")
        proxy_ip_port = input("Enter proxy IP:Port: ")
        
        result = execute_remote_proxy_script(target_ip, password, proxy_ip_port)
        print(format_output(result))
