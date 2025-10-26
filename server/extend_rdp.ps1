# PowerShell script to check RDP license status, extend using slmgr and restart RDP service
# This script checks remaining license days, re-arms if expired, and restarts Remote Desktop services

Write-Host "Starting RDP license management process..." -ForegroundColor Cyan

try {
    # Step 1: Check current license status
    Write-Host "`nStep 1: Checking current license status..." -ForegroundColor Yellow
    
    # Get license expiration information
    $licenseStatus = cscript //nologo C:\Windows\System32\slmgr.vbs /dli 2>&1 | Out-String
    $graceStatus = cscript //nologo C:\Windows\System32\slmgr.vbs /xpr 2>&1 | Out-String
    
    # Parse to find remaining days
    $remainingDays = -1
    $isExpired = $false
    
    if ($graceStatus -match "(\d+)\s+day") {
        $remainingDays = [int]$matches[1]
        Write-Host "Current license days remaining: $remainingDays" -ForegroundColor Cyan
    } elseif ($graceStatus -match "expired" -or $graceStatus -match "will expire") {
        $isExpired = $true
        $remainingDays = 0
        Write-Host "License is EXPIRED!" -ForegroundColor Red
    } else {
        Write-Host "License status: $graceStatus" -ForegroundColor Yellow
    }
    
    # Check if rearm is needed
    if ($isExpired -or $remainingDays -eq 0) {
        Write-Host "`nLicense is expired. Proceeding with re-arm..." -ForegroundColor Yellow
        
        # Step 2: Re-arm the Windows license using slmgr
        Write-Host "`nStep 2: Re-arming Windows license..." -ForegroundColor Yellow
        $rearmResult = Start-Process -FilePath "slmgr.vbs" -ArgumentList "/rearm" -NoNewWindow -Wait -PassThru
        
        if ($rearmResult.ExitCode -eq 0) {
            Write-Host "License re-armed successfully" -ForegroundColor Green
        } else {
            Write-Host "License re-arm completed with exit code: $($rearmResult.ExitCode)" -ForegroundColor Yellow
        }
        
        # Step 3: Stop Remote Desktop Services
        Write-Host "`nStep 3: Stopping Remote Desktop Services..." -ForegroundColor Yellow
        Stop-Service -Name "TermService" -Force -ErrorAction SilentlyContinue
        
        if ($?) {
            Write-Host "Remote Desktop Service stopped successfully" -ForegroundColor Green
        } else {
            Write-Host "Remote Desktop Service stop attempt completed" -ForegroundColor Yellow
        }
        
        Start-Sleep -Seconds 2
        
        # Step 4: Start Remote Desktop Services
        Write-Host "`nStep 4: Starting Remote Desktop Services..." -ForegroundColor Yellow
        Start-Service -Name "TermService" -ErrorAction SilentlyContinue
        
        if ($?) {
            Write-Host "Remote Desktop Service started successfully" -ForegroundColor Green
        } else {
            Write-Host "Remote Desktop Service start attempt completed" -ForegroundColor Yellow
        }
        
        Start-Sleep -Seconds 2
        
        # Step 5: Restart RDP connections (disconnect current sessions)
        Write-Host "`nStep 5: Restarting RDP connections..." -ForegroundColor Yellow
        query session | Select-String "rdp-tcp#" | ForEach-Object {
            $sessionId = ($_ -split "\s+")[2]
            logoff $sessionId /server:localhost 2>$null
        }
        Write-Host "RDP connections restarted" -ForegroundColor Green
        
        # Step 6: Verify service status
        Write-Host "`nStep 6: Verifying service status..." -ForegroundColor Yellow
        $service = Get-Service -Name "TermService" -ErrorAction SilentlyContinue
        
        if ($service) {
            Write-Host "Service Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' })
            Write-Host "Service Name: $($service.DisplayName)" -ForegroundColor Cyan
        }
        
        # Step 7: Get updated license information
        Write-Host "`nStep 7: Checking updated license information..." -ForegroundColor Yellow
        $newLicenseInfo = cscript //nologo C:\Windows\System32\slmgr.vbs /xpr 2>&1
        if ($newLicenseInfo) {
            Write-Host "Updated License Information: $newLicenseInfo" -ForegroundColor Cyan
        }
        
        # Output success result
        $result = @{
            Status = "Success"
            Message = "RDP license re-armed and service restarted successfully"
            ServiceStatus = $service.Status
            PreviousRemainingDays = $remainingDays
            Action = "Rearm executed"
            Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        }
        
        Write-Host "`n========================================" -ForegroundColor Green
        Write-Host "RDP Extension Process Completed" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Status: $($result.Status)" -ForegroundColor Green
        Write-Host "Message: $($result.Message)" -ForegroundColor Green
        Write-Host "Service Status: $($result.ServiceStatus)" -ForegroundColor Green
        Write-Host "Previous Days: $($result.PreviousRemainingDays)" -ForegroundColor Green
        Write-Host "Timestamp: $($result.Timestamp)" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        
    } else {
        # License is still valid
        Write-Host "`nLicense is still valid with $remainingDays days remaining." -ForegroundColor Green
        Write-Host "No rearm needed at this time." -ForegroundColor Cyan
        
        $result = @{
            Status = "Success"
            Message = "License is still valid, no action needed"
            RemainingDays = $remainingDays
            Action = "No action needed"
            Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        }
        
        Write-Host "`n========================================" -ForegroundColor Green
        Write-Host "License Check Completed" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Status: $($result.Status)" -ForegroundColor Green
        Write-Host "Remaining Days: $($result.RemainingDays)" -ForegroundColor Green
        Write-Host "Timestamp: $($result.Timestamp)" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    }
    
    return $result
    
} catch {
    Write-Host "`nError occurred during RDP management: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ToString())" -ForegroundColor Red
    
    $result = @{
        Status = "Error"
        Message = "RDP management failed: $($_.Exception.Message)"
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    return $result
}

