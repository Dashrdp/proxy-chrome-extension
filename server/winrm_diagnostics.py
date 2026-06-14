import socket
from typing import Any, Optional

from pypsrp.powershell import PowerShell, RunspacePool
from pypsrp.wsman import WSMan

WINRM_HTTP_PORT = 5985
WINRM_HTTPS_PORT = 5986
TCP_TIMEOUT_SECONDS = 5

ERROR_CATALOG = {
    "SERVER_UNREACHABLE": {
        "error_title": "Server not reachable",
        "recommendation": "Confirm the server IP is correct and the host is online. Check firewall rules and that the VM is running.",
    },
    "WINRM_PORT_CLOSED": {
        "error_title": "WinRM port not accessible",
        "recommendation": "Enable WinRM on the server (port 5985) and allow inbound traffic from the API server.",
    },
    "INVALID_CREDENTIALS": {
        "error_title": "Credentials rejected",
        "recommendation": "Verify the Administrator password on the WHMCS service page. Password may have been rotated.",
    },
    "WINRM_NOT_CONFIGURED": {
        "error_title": "WinRM not configured",
        "recommendation": "Run 'Enable-PSRemoting -Force' on the target server and verify WinRM service is running.",
    },
    "DNS_RESOLUTION_FAILED": {
        "error_title": "Hostname could not be resolved",
        "recommendation": "Use the numeric server IP from WHMCS instead of a hostname.",
    },
    "EXECUTION_FAILED": {
        "error_title": "Remote execution failed",
        "recommendation": "Preflight passed but the proxy script failed. Check server logs and proxy IP:Port.",
    },
    "PROXY_INACTIVE": {
        "error_title": "Proxy not active",
        "recommendation": "WinRM connected but traffic still exits via the server IP. Verify proxy IP:Port and that the proxy service is running.",
    },
    "UNKNOWN_ERROR": {
        "error_title": "Unexpected error",
        "recommendation": "Retry the operation. If it persists, check API server logs.",
    },
}


def build_error_response(error_code: str, error_detail: str, target_ip: Optional[str] = None) -> dict[str, Any]:
    catalog = ERROR_CATALOG.get(error_code, ERROR_CATALOG["UNKNOWN_ERROR"])
    title = catalog["error_title"]
    detail = error_detail
    if target_ip and target_ip not in detail:
        detail = f"{detail} (target: {target_ip})"

    return {
        "error_code": error_code,
        "error_title": title,
        "error_detail": detail,
        "error": f"{title}: {detail}",
        "recommendation": catalog["recommendation"],
    }


def classify_connection_error(exc: Exception, target_ip: Optional[str] = None) -> dict[str, Any]:
    message = str(exc)
    lowered = message.lower()

    if any(token in lowered for token in ("401", "unauthorized", "access is denied", "logon failure", "bad password", "unknown user name")):
        return build_error_response(
            "INVALID_CREDENTIALS",
            "WinRM rejected the Administrator password.",
            target_ip,
        )

    if any(token in lowered for token in ("name or service not known", "nodename nor servname", "getaddrinfo failed")):
        return build_error_response(
            "DNS_RESOLUTION_FAILED",
            "The server hostname could not be resolved.",
            target_ip,
        )

    if any(token in lowered for token in ("timed out", "timeout", "no route to host", "network is unreachable", "host is down")):
        return build_error_response(
            "SERVER_UNREACHABLE",
            "Could not reach the server — connection timed out or host is offline.",
            target_ip,
        )

    if any(token in lowered for token in ("connection refused", "actively refused", "errno 111", "errno 61")):
        return build_error_response(
            "WINRM_PORT_CLOSED",
            f"WinRM port {WINRM_HTTP_PORT} is not accepting connections.",
            target_ip,
        )

    if any(token in lowered for token in ("winrm", "wsman", "remoting", "ssl", "certificate")):
        return build_error_response(
            "WINRM_NOT_CONFIGURED",
            message,
            target_ip,
        )

    return build_error_response("UNKNOWN_ERROR", message, target_ip)


def check_tcp_port(host: str, port: int, timeout: int = TCP_TIMEOUT_SECONDS) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, f"Port {port} is open"
    except socket.timeout:
        return False, f"Port {port} timed out after {timeout}s"
    except ConnectionRefusedError:
        return False, f"Port {port} refused the connection"
    except OSError as exc:
        lowered = str(exc).lower()
        if "timed out" in lowered:
            return False, f"Port {port} timed out — server may be offline"
        if "unreachable" in lowered or "no route" in lowered:
            return False, "Server is unreachable on the network"
        return False, str(exc)


def test_winrm_credentials(target_ip: str, password: str, use_ssl: bool = False) -> tuple[bool, str]:
    port = WINRM_HTTPS_PORT if use_ssl else WINRM_HTTP_PORT
    try:
        wsman = WSMan(
            target_ip,
            username="Administrator",
            password=password,
            ssl=use_ssl,
            port=port,
            auth="basic",
            encryption="never",
        )
        pool = RunspacePool(wsman)
        pool.open()
        ps = PowerShell(pool)
        ps.add_script("$env:COMPUTERNAME")
        output = ps.invoke()
        pool.close()
        hostname = output[0].strip() if output else "unknown"
        return True, f"Authenticated successfully (hostname: {hostname})"
    except Exception as exc:
        return False, str(exc)


def run_preflight_check(target_ip: str, password: str) -> dict[str, Any]:
    checks: list = []

    port_open, port_message = check_tcp_port(target_ip, WINRM_HTTP_PORT)
    checks.append({
        "name": "winrm_port",
        "label": f"WinRM port {WINRM_HTTP_PORT}",
        "ok": port_open,
        "message": port_message,
    })

    if not port_open:
        ssl_open, ssl_message = check_tcp_port(target_ip, WINRM_HTTPS_PORT)
        checks.append({
            "name": "winrm_ssl_port",
            "label": f"WinRM SSL port {WINRM_HTTPS_PORT}",
            "ok": ssl_open,
            "message": ssl_message,
        })
        if not ssl_open:
            error = build_error_response(
                "WINRM_PORT_CLOSED",
                f"Neither WinRM port {WINRM_HTTP_PORT} nor {WINRM_HTTPS_PORT} is reachable.",
                target_ip,
            )
            return {
                "success": False,
                "checks": checks,
                **error,
            }

    auth_ok, auth_message = test_winrm_credentials(target_ip, password, use_ssl=False)
    checks.append({
        "name": "winrm_auth",
        "label": "Administrator credentials",
        "ok": auth_ok,
        "message": auth_message if auth_ok else "Authentication failed",
    })

    if not auth_ok:
        error = classify_connection_error(Exception(auth_message), target_ip)
        return {
            "success": False,
            "checks": checks,
            **error,
        }

    return {
        "success": True,
        "checks": checks,
        "message": "Server is reachable and credentials are valid",
    }
