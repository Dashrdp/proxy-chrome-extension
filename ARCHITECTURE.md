# DashRDP Proxy Configurator — Architecture

Internal ops tool for configuring Windows RDP proxy settings from WHMCS service pages.

## Components

```
WHMCS page  →  content.js  →  popup.js  →  background.js  →  Flask API  →  WinRM  →  Windows RDP
```

| Layer | File | Role |
|-------|------|------|
| Content script | `chrome-extension/content.js` | Scrapes server IP, password, and proxy IP:Port from the active page DOM. Auto-extracts on load and notifies the extension when fields are found. |
| Popup UI | `chrome-extension/popup.js` | Form for credentials, manual extract, execute, session persistence, and detection banner. |
| Service worker | `chrome-extension/background.js` | Proxies API calls to `https://proxyconf-api.dashrdp.cloud`, relays progress updates and pending extractions. |
| API server | `server/app.py` | Flask app that receives credentials and runs PowerShell over WinRM on the target Windows host. |
| Reverse proxy | `server/Caddyfile` | TLS termination and routing to the Flask container. |

## Data flow — configure proxy

1. Operator opens a WHMCS service page (or similar admin page with credential fields).
2. `content.js` auto-scans the DOM on load. If fields are found, it sends `dataAvailable` to the background worker.
3. Background stores the extraction in `chrome.storage.session` and forwards to the popup if open.
4. Popup shows a **Fields detected — click to fill** banner. Operator confirms or manually edits fields.
5. Operator clicks **EXECUTE SCRIPT**. Popup sends `executeScript` to the background worker.
6. Background POSTs to `/api/execute-script` with server IP, password, proxy IP:Port, and browser timezone.
7. Flask connects via WinRM (pypsrp) and runs PowerShell to:
   - Set system and user proxy registry keys
   - Verify public IP/geo through the proxy (ipinfo.io)
   - Sync Windows timezone to match the operator's browser
8. Result text is returned to the popup and displayed in the results panel.

## Data flow — manual extract

1. Operator clicks **EXTRACT FROM PAGE** in the popup.
2. Popup injects `content.js` if needed, then sends `extractFields` to the content script.
3. Content script returns `{ serverIp, password, proxyIpPort }` and popup fills the form.

## Persistence

- Form fields are saved to `chrome.storage.local` on every input change.
- On popup open, saved fields are restored (no longer wiped).
- **Clear session** explicitly wipes local storage and form fields.
- Pending auto-extractions live in `chrome.storage.session` until filled or dismissed.

## API endpoints (current)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | None | Health check (shown in popup header) |
| POST | `/api/preflight-check` | None | WinRM port + credential check before configure |
| POST | `/api/execute-script` | None today | Configure proxy on remote Windows host |

> API key authentication is planned for Phase 3. The extension currently sends unauthenticated requests.

## Canonical hostname

**`https://proxyconf-api.dashrdp.cloud`** — used in `background.js`, `Caddyfile`, and all documentation.

## Options

Right-click the extension icon → **Options**, or click the gear in the popup header.

| Setting | Default | Purpose |
|---------|---------|---------|
| API base URL | `https://proxyconf-api.dashrdp.cloud` | Point at dev/staging/prod |
| Remember fields | on | Persist form data in `chrome.storage.local` |
| Auto-extract WHMCS | on | Detect fields when a WHMCS service page loads |

## Content script scope

Auto-injected on:
- `*://portal.dashrdp.com/*`
- `*://*/admin/clientsservices.php*`
- `*://*/admin/clientservices.php*`
- `*://*/admin/clientssummary.php*`

Other pages: use **Extract from page** (on-demand inject via `scripting` permission).

## Security notes (current state)

- Credentials are persisted in `chrome.storage.local` (including passwords) until cleared.
- WinRM uses HTTP without encryption (`ssl=False`).
- No API authentication on `/api/execute-script`.
- These are addressed in Phase 3 of the roadmap.

## Deployment

See `server/DEPLOYMENT.md` for Docker + Caddy production setup.
