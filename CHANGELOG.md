# Changelog

## v1.2.1 — Pre-flight graceful fallback (2026-06-14)

### Extension
- When `/api/preflight-check` returns 404 (not deployed yet), **Configure Proxy** skips pre-flight and continues with script execution
- **Test connection** shows `PREFLIGHT_NOT_DEPLOYED` with deploy instructions instead of `API_UNREACHABLE`
- Fixes false "Invalid API response" when the live API is healthy but missing the new endpoint

---

## v1.2.0 — Pre-flight checks + detailed errors (2026-06-14)

### Pre-flight connectivity check
- New `POST /api/preflight-check` — TCP probe on WinRM port 5985, then credential validation
- Runs automatically before **Configure Proxy**
- New **Test connection** button for standalone checks

### Detailed error display
- Structured error codes: `SERVER_UNREACHABLE`, `WINRM_PORT_CLOSED`, `INVALID_CREDENTIALS`, `WINRM_NOT_CONFIGURED`, `API_UNREACHABLE`, etc.
- Error panel shows title, detail, recommendation, and per-check results (port open ✓/✗, auth ✓/✗)

### Server
- New `server/winrm_diagnostics.py` with error classification
- `execute-script` errors now return structured JSON

---

## v1.1.0 — Phase 2: Operator UX (2026-06-14)

### Workflow
- Renamed primary CTA to **Configure Proxy**
- Extraction confidence panel shows field values and DOM source (e.g. `customfield[390]`, `td.fieldlabel`)
- WHMCS pages auto-fill extracted fields and require one-click "Looks good" confirmation before configure
- Scrollable popup (max 600px) with expandable results panel and copy-to-clipboard
- Jobs survive popup close: badge + notification on completion, last result restored from session

### WHMCS targeting
- Content script scoped to `portal.dashrdp.com` and WHMCS admin service pages
- On-demand `scripting` inject still works on other pages via Extract button

### Options page
- API base URL override (dev/staging/prod)
- Toggle: remember fields between sessions
- Toggle: auto-extract on WHMCS pages

### Polish
- Inter font applied throughout
- Emoji replaced with SVG icons
- Inline help: "Open WHMCS service page → Extract → Configure Proxy"
- Clearer input placeholders (no misleading example IPs)

---

## v1.0.1 — Phase 1: Stabilize (2026-06-14)

### Bug fixes
- **Persistence**: Popup now restores saved fields on open instead of wiping storage every time
- **Auto-extract**: `dataAvailable` from content script is wired through background → popup with a "Fields detected — click to fill" banner
- **Manifest**: Removed stale `python_script.py` web_accessible_resources entry
- **Icons**: Added 16/48/128 PNG icons from existing SVG

### Cleanup
- Removed dead functions from `background.js` (`simulatePythonScript`, `simulateProxyCheck`, `executeViaNativeMessaging`)
- Removed orphan CSS (`.access-status`, `.btn-security`, `.info-panel`, etc.)
- Standardized API hostname to `proxyconf-api.dashrdp.cloud` across all docs

### Documentation
- Rewrote `README.md` to reflect current behavior (no API keys today)
- Added `ARCHITECTURE.md` for new team members
- Archived stale RDP license docs from README (endpoints remain in server if deployed, but are not part of the extension UI)

---

## Historical — RDP License Management (server-side)

Earlier versions added RDP license check/extend endpoints to `server/app.py`. These are server-only features not exposed in the current Chrome extension UI. See git history for full technical details.
