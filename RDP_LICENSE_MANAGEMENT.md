# RDP License Management Feature

## Overview

This document describes the RDP License Management feature that has been added to the DashRDP Chrome Extension. This feature automatically checks the RDP license status and only performs a rearm operation if the license has expired.

## Features

### 1. **Automatic License Status Check**
- Before performing any rearm operation, the system first checks how many days remain on the RDP license
- Uses `slmgr.vbs /dli` and `slmgr.vbs /xpr` to get license information
- Parses the output to determine remaining days

### 2. **Smart Rearm Decision**
- **If license is expired (0 days remaining):**
  - Automatically executes `slmgr.vbs /rearm`
  - Restarts the RDP service (TermService)
  - Disconnects active RDP sessions to force reconnection
  - Shows success message with previous remaining days

- **If license is still valid (days > 0):**
  - Skips the rearm operation
  - Displays remaining days
  - Shows "No action needed" message

### 3. **RDP Service Management**
After a successful rearm, the system:
1. Stops the TermService (Remote Desktop Service)
2. Waits 2 seconds
3. Starts the TermService
4. Disconnects current RDP sessions
5. Verifies service status

## API Endpoints

### 1. `/api/check-rdp-license` (POST)
Checks the current RDP license status without making any changes.

**Request:**
```json
{
  "serverIp": "192.168.1.100",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "result": "✅ LICENSE ACTIVE\nRemaining Days: 120\nGrace Status: ...\nTimestamp: ...",
  "remaining_days": 120,
  "is_expired": false
}
```

### 2. `/api/extend-rdp` (POST)
Checks license status and only performs rearm if expired.

**Request:**
```json
{
  "serverIp": "192.168.1.100",
  "password": "your_password",
  "forceRearm": false  // Optional: set to true to force rearm regardless of status
}
```

**Response (License Valid):**
```json
{
  "success": true,
  "result": "✅ RDP License Still Valid\nRemaining Days: 120\nAction: No rearm needed\n...",
  "action_taken": "no_action_needed",
  "remaining_days": 120
}
```

**Response (License Expired - Rearm Executed):**
```json
{
  "success": true,
  "result": "RDP Extension Complete\nStatus: Success\nService Status: Running\n...",
  "action_taken": "rearm_executed",
  "previous_remaining_days": 0
}
```

## Backend Implementation

### Python Functions

#### `check_rdp_license_status(target_ip, password)`
Connects to the remote Windows machine and checks license status.

**Returns:**
```python
{
    "license_status": "...",
    "grace_status": "...",
    "remaining_days": 120,
    "is_expired": False,
    "timestamp": "2024-10-26T..."
}
```

#### `execute_rdp_rearm(target_ip, password)`
Executes the rearm command and restarts RDP service.

**PowerShell Script:**
```powershell
# Re-arm Windows license
$rearmResult = Start-Process -FilePath "slmgr.vbs" -ArgumentList "/rearm" -NoNewWindow -Wait -PassThru

# Stop RDP service
Stop-Service -Name "TermService" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start RDP service
Start-Service -Name "TermService" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Restart RDP connections (disconnect current sessions)
query session | Select-String "rdp-tcp#" | ForEach-Object {
    $sessionId = ($_ -split "\s+")[2]
    logoff $sessionId /server:localhost 2>$null
}
```

## Frontend Implementation

### Chrome Extension Flow

1. **User clicks "EXTEND RDP LICENSE" button**
2. Extension validates Server IP and Password
3. Sends `checkRdpLicense` message to background script
4. Background script calls `/api/check-rdp-license`
5. **Decision Point:**
   - If expired: Calls `/api/extend-rdp` to rearm
   - If valid: Shows remaining days, no action
6. Displays results to user

### JavaScript Functions

#### `executeRdpExtension()`
Main function that orchestrates the license check and rearm process.

**Workflow:**
```javascript
1. Validate inputs (Server IP, Password)
2. Check license status via checkRdpLicense action
3. Display current status
4. If expired:
   - Execute rearm via extendRdp action
   - Show success/failure message
5. If valid:
   - Show remaining days
   - No further action
```

## PowerShell Script (`extend_rdp.ps1`)

The updated PowerShell script now includes:

### Step 1: Check License Status
```powershell
$licenseStatus = cscript //nologo C:\Windows\System32\slmgr.vbs /dli
$graceStatus = cscript //nologo C:\Windows\System32\slmgr.vbs /xpr

# Parse remaining days
if ($graceStatus -match "(\d+)\s+day") {
    $remainingDays = [int]$matches[1]
}
```

### Step 2-7: Conditional Rearm
Only executes if `$isExpired -or $remainingDays -eq 0`

## UI Display

### Status Messages

**License Active:**
```
✅ LICENSE ACTIVE
Remaining Days: 120
Grace Status: The machine is permanently activated.
Timestamp: 2024-10-26 10:30:45
```

**License Expired:**
```
⚠️ LICENSE EXPIRED
Remaining Days: 0
Grace Status: The Windows license will expire soon.
Timestamp: 2024-10-26 10:30:45
```

**After Rearm:**
```
RDP Extension Complete
Status: Success
Service Status: Running
Rearm Code: 0
Timestamp: 2024-10-26 10:32:15

Previous Remaining Days: 0
Action: License re-armed and RDP restarted
```

## Usage Examples

### Example 1: License Still Valid
```
User clicks "EXTEND RDP LICENSE"
→ System checks: 45 days remaining
→ Display: "✅ License is still valid (45 days remaining). No action needed."
→ No rearm executed
```

### Example 2: License Expired
```
User clicks "EXTEND RDP LICENSE"
→ System checks: 0 days remaining
→ Display: "⚠️ License expired. Executing rearm and restart..."
→ Executes slmgr /rearm
→ Restarts TermService
→ Disconnects RDP sessions
→ Display: "✅ RDP license re-armed and RDP service restarted successfully"
```

### Example 3: Force Rearm
```
API Call with forceRearm: true
→ Skips license check
→ Executes rearm immediately
→ Restarts service
```

## Error Handling

### Connection Errors
```json
{
  "success": false,
  "error": "Cannot connect to server at https://proxyconf-api.dashrdp.cloud"
}
```

### Authentication Errors
```json
{
  "success": false,
  "error": "License check failed: Authentication failed"
}
```

### Permission Errors
```json
{
  "success": false,
  "error": "RDP rearm failed: Access denied. Administrator privileges required"
}
```

## Testing

### Test Case 1: Check Valid License
1. Open Chrome Extension
2. Fill in Server IP and Password
3. Click "EXTEND RDP LICENSE"
4. Verify it shows remaining days without rearming

### Test Case 2: Check Expired License
1. Connect to a server with expired license
2. Click "EXTEND RDP LICENSE"
3. Verify it shows "License expired" message
4. Verify rearm is executed
5. Verify RDP service restarts

### Test Case 3: Force Rearm
1. Use API endpoint with `forceRearm: true`
2. Verify rearm executes regardless of status

## Deployment

### Server Deployment
1. Deploy updated `app.py` with new endpoints
2. Ensure `extend_rdp.ps1` is updated
3. Restart Flask/Gunicorn server

### Chrome Extension Deployment
1. Update `background.js` with new message handlers
2. Update `popup.js` with new UI logic
3. Package and upload to Chrome Web Store

## Security Considerations

1. **Authentication Required:** All API calls require Server IP and Administrator password
2. **HTTPS Only:** Production server uses HTTPS (proxyconf-api.dashrdp.cloud)
3. **No Password Storage:** Passwords are not stored, only transmitted for authentication
4. **Admin Privileges:** Rearm operation requires Administrator privileges on Windows

## Limitations

1. **Rearm Limit:** Windows allows only 3-6 rearms depending on the version
2. **Service Disruption:** RDP sessions will be disconnected during restart
3. **Requires Admin:** Must connect as Administrator to perform rearm
4. **Windows Only:** This feature only works on Windows servers

## Future Enhancements

1. **Rearm Counter:** Track how many rearms have been used
2. **Scheduled Checks:** Automatically check license status daily
3. **Email Alerts:** Send alerts when license is about to expire
4. **Batch Operations:** Check/rearm multiple servers at once
5. **License History:** Keep a log of all license checks and rearms

## Troubleshooting

### Issue: "License check failed"
**Solution:** Verify Server IP, password, and WinRM is enabled on the target server

### Issue: "Rearm failed with exit code 3221225566"
**Solution:** Rearm limit may have been reached. Consider activating Windows properly.

### Issue: "RDP service not restarting"
**Solution:** Check Windows Event Viewer for TermService errors. May need manual restart.

### Issue: "Cannot connect to server"
**Solution:** Verify the backend server is running and accessible at the configured URL.

## Technical Architecture

```
┌─────────────────┐
│  Chrome Popup   │
│  (popup.js)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Background.js  │
│  (API Handler)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Flask Server   │
│  (app.py)       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   pypsrp lib    │
│  (WinRM/PS)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Windows Server  │
│  (slmgr.vbs)    │
│  (TermService)  │
└─────────────────┘
```

## Changelog

### Version 1.1.0 (2024-10-26)
- ✅ Added automatic license status check before rearm
- ✅ Added `/api/check-rdp-license` endpoint
- ✅ Updated `/api/extend-rdp` to check before rearming
- ✅ Added RDP service restart functionality
- ✅ Added RDP session disconnect on rearm
- ✅ Improved UI feedback with remaining days display
- ✅ Added smart decision logic (rearm only if expired)

## Support

For issues or questions, please contact:
- Email: support@dashrdp.cloud
- GitHub: [Your Repo URL]
- Documentation: [Your Docs URL]

