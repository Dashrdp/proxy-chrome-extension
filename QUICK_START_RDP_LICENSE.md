# Quick Start: RDP License Management

## What's New? 🚀

The RDP Extension now **intelligently checks your license status** before performing any rearm operation. No more wasting precious rearm attempts!

---

## How It Works

### 1️⃣ Click "EXTEND RDP LICENSE" Button

### 2️⃣ System Checks License
- Connects to your Windows server
- Runs `slmgr.vbs /xpr` to check remaining days
- Shows you the status

### 3️⃣ Smart Decision
- **If Expired (0 days):** 
  - ✅ Runs `slmgr.vbs /rearm`
  - ✅ Restarts RDP service
  - ✅ Disconnects sessions (forces reconnect)
  
- **If Valid (days > 0):**
  - ℹ️ Shows remaining days
  - ℹ️ No action taken
  - ℹ️ Preserves rearm count

---

## Example Scenarios

### Scenario 1: License Still Valid ✅
```
You: *clicks EXTEND RDP LICENSE*
System: "Checking license..."
System: "✅ License is still valid (45 days remaining). No action needed."
Result: Nothing changed, rearm saved for later!
```

### Scenario 2: License Expired ⚠️
```
You: *clicks EXTEND RDP LICENSE*
System: "Checking license..."
System: "⚠️ License expired. Executing rearm..."
System: "Stopping RDP service..."
System: "Starting RDP service..."
System: "Restarting connections..."
System: "✅ RDP license re-armed and RDP service restarted successfully"
Result: License extended, RDP restarted, ready to use!
```

---

## Quick Reference

### Status Indicators:
- ✅ **LICENSE ACTIVE** - License is valid
- ⚠️ **LICENSE EXPIRED** - License needs rearm
- ℹ️ **LICENSE STATUS UNKNOWN** - Could not determine status

### Actions Taken:
- **Rearm executed** - System performed rearm and restart
- **No action needed** - License still valid, nothing changed

---

## Usage Instructions

### Step 1: Open Extension
Click the DashRDP extension icon in Chrome

### Step 2: Fill in Details
- **Server IP:** Your Windows server IP (e.g., 192.168.1.100)
- **Password:** Administrator password

### Step 3: Click Button
Click "EXTEND RDP LICENSE" button

### Step 4: Review Results
- Read the status message
- Check remaining days
- See if rearm was executed

---

## API Usage (For Developers)

### Check License Only (No Changes)
```bash
curl -X POST https://proxyconf-api.dashrdp.cloud/api/check-rdp-license \
  -H "Content-Type: application/json" \
  -d '{
    "serverIp": "192.168.1.100",
    "password": "your_password"
  }'
```

### Smart Extend (Auto-Check + Rearm if Needed)
```bash
curl -X POST https://proxyconf-api.dashrdp.cloud/api/extend-rdp \
  -H "Content-Type: application/json" \
  -d '{
    "serverIp": "192.168.1.100",
    "password": "your_password"
  }'
```

### Force Rearm (Skip Check)
```bash
curl -X POST https://proxyconf-api.dashrdp.cloud/api/extend-rdp \
  -H "Content-Type: application/json" \
  -d '{
    "serverIp": "192.168.1.100",
    "password": "your_password",
    "forceRearm": true
  }'
```

---

## What Happens During Rearm?

1. ✅ Execute `slmgr.vbs /rearm`
2. ✅ Stop TermService (RDP Service)
3. ✅ Wait 2 seconds
4. ✅ Start TermService
5. ✅ Disconnect active RDP sessions
6. ✅ Verify service is running
7. ✅ Return success status

**⏱️ Total Time:** ~8-10 seconds

**⚠️ Note:** Your RDP session will be disconnected. You'll need to reconnect.

---

## Troubleshooting

### "License check failed"
- ✅ Verify Server IP is correct
- ✅ Verify password is correct
- ✅ Check WinRM is enabled on server
- ✅ Ensure server is reachable

### "Rearm failed"
- ❌ Rearm limit may be reached (3-6 max)
- 🔧 Consider proper Windows activation
- 📞 Contact Windows licensing support

### "RDP service not restarting"
- 🔄 Try manual restart: `Restart-Service TermService`
- 📋 Check Windows Event Viewer
- 🔧 Verify TermService is set to Automatic

### "Cannot connect to server"
- 🌐 Check backend server is running
- 🔗 Verify URL: https://proxyconf-api.dashrdp.cloud
- 🔐 Check firewall settings

---

## Important Reminders

### ⚠️ Rearm Limit
Windows allows only **3-6 rearms** total. After that, you need to properly activate Windows. This feature helps you conserve those rearms!

### 🔐 Administrator Required
You must use Administrator credentials to check license and perform rearm.

### 🔌 RDP Disconnection
During rearm, active RDP sessions are disconnected. This is necessary for the license to take effect. Simply reconnect after completion.

### 💾 No Data Loss
Rearm and RDP restart do not affect your data or running applications (except RDP session).

---

## Benefits of New Feature

### Before:
❌ Always executed rearm (wasted attempts)  
❌ No visibility into license status  
❌ No control over when to rearm  
❌ Confusing results  

### After:
✅ Only rearms when needed  
✅ Shows remaining days clearly  
✅ Saves rearm attempts  
✅ Clear feedback on actions taken  
✅ Better control and monitoring  

---

## FAQ

**Q: Will this work on already expired licenses?**  
A: Yes! If expired, it will automatically rearm.

**Q: Can I check license without rearming?**  
A: Yes! Use the "Check License Only" API endpoint.

**Q: How many times can I rearm?**  
A: Windows typically allows 3-6 rearms. This varies by Windows version.

**Q: Will my work be lost?**  
A: No. Only RDP session disconnects. Applications keep running.

**Q: Can I force rearm even if license is valid?**  
A: Yes. Use `forceRearm: true` parameter in API call.

**Q: Does this require any special permissions?**  
A: Yes. Administrator credentials are required.

---

## Video Tutorial

🎥 Coming soon! Check back for video walkthrough.

---

## Need Help?

📧 **Email:** support@dashrdp.cloud  
📚 **Docs:** See RDP_LICENSE_MANAGEMENT.md for detailed documentation  
🐛 **Issues:** Report bugs via GitHub issues  
💬 **Chat:** Contact support team  

---

## What's Next?

Future enhancements planned:
- 📊 Rearm counter tracking
- 📧 Email alerts for expiring licenses
- 🔄 Scheduled automatic checks
- 📈 License history dashboard
- 🔀 Multi-server batch operations

---

**Happy License Managing! 🎉**

*Last Updated: October 26, 2024*

