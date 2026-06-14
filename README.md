# DashRDP Proxy Configurator

Chrome extension + Flask API for internal ops staff to configure Windows RDP proxy settings from WHMCS service pages.

## What it does

1. Open a WHMCS service page (or similar admin page)
2. Extension auto-detects server IP, password, and proxy IP:Port from the page
3. Operator reviews fields and clicks **EXECUTE SCRIPT**
4. API connects to the Windows host via WinRM, configures proxy, verifies geo, and syncs timezone

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system diagram and data flow.

## Quick start — extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `chrome-extension/`
4. Pin the extension and open a WHMCS service page
5. Click the extension icon — saved fields restore automatically; a detection banner appears if fields were found on the page

## Quick start — API (development)

```bash
cd server
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

API runs at `http://localhost:5000`. Update `SERVER_CONFIG.url` in `chrome-extension/background.js` to point at your server.

## Production API

Deployed at **`https://proxyconf-api.dashrdp.cloud`** via Docker + Caddy. See `server/DEPLOYMENT.md`.

## API endpoints

### GET /api/health

No authentication required.

```json
{ "status": "healthy", "timestamp": "...", "service": "DashRDP Proxy Configurator API" }
```

### POST /api/execute-script

No authentication required today (Phase 3 will add `X-API-Key`).

**Request:**
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
  "result": "Public IP: 203.0.113.1\nISP: Example ISP\nCountry: US\nStatus: Proxy Active"
}
```

## Configuration

The extension server URL is set in `chrome-extension/background.js`:

```javascript
const SERVER_CONFIG = {
    url: 'https://proxyconf-api.dashrdp.cloud'
};
```

There is no API key configuration today. Phase 3 will add an options page for key storage.

## Session behavior

- Fields persist between popup opens via `chrome.storage.local`
- Use **Clear session** to wipe saved credentials
- Auto-detected fields from the current page appear in a blue banner — click **Fill** to apply

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API Offline in popup header | Check server is running; verify `SERVER_CONFIG.url` |
| No fields detected | Reload WHMCS page; use **EXTRACT FROM PAGE** manually |
| Connection error on execute | Verify WinRM is enabled on target host; check credentials |
| Fields empty on open | Previously wiped on every open — fixed in v1.0.1; use **Clear session** to reset |

## Project structure

```
proxy-chrome-extension/
├── chrome-extension/     # MV3 extension (popup, content script, background)
├── server/               # Flask API + Docker deployment
├── ARCHITECTURE.md       # System design reference
└── CHANGELOG.md          # Historical change log
```

## License

MIT
