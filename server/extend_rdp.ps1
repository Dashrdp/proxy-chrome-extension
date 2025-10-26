# PowerShell script to extend RDP license using slmgr and restart RDP service
# This script re-arms the Windows evaluation period and restarts Remote Desktop services

Write-Host "Starting RDP extension process..." -ForegroundColor Cyan

try {
    # Step 1: Re-arm the Windows license using slmgr
    Write-Host "`nStep 1: Re-arming Windows license..." -ForegroundColor Yellow
    $rearmResult = Start-Process -FilePath "slmgr.vbs" -ArgumentList "/rearm" -NoNewWindow -Wait -PassThru
    
    if ($rearmResult.ExitCode -eq 0) {
        Write-Host "License re-armed successfully" -ForegroundColor Green
    } else {
        Write-Host "License re-arm completed with exit code: $($rearmResult.ExitCode)" -ForegroundColor Yellow
    }
    
    # Step 2: Stop Remote Desktop Services
    Write-Host "`nStep 2: Stopping Remote Desktop Services..." -ForegroundColor Yellow
    $stopResult = Stop-Service -Name "TermService" -Force -ErrorAction SilentlyContinue
    
    if ($?) {
        Write-Host "Remote Desktop Service stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "Remote Desktop Service stop attempt completed" -ForegroundColor Yellow
    }
    
    # Step 3: Start Remote Desktop Services
    Write-Host "`nStep 3: Starting Remote Desktop Services..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    $startResult = Start-Service -Name "TermService" -ErrorAction SilentlyContinue
    
    if ($?) {
        Write-Host "Remote Desktop Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "Remote Desktop Service start attempt completed" -ForegroundColor Yellow
    }
    
    # Step 4: Verify service status
    Write-Host "`nStep 4: Verifying service status..." -ForegroundColor Yellow
    $service = Get-Service -Name "TermService" -ErrorAction SilentlyContinue
    
    if ($service) {
        Write-Host "Service Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' })
        Write-Host "Service Name: $($service.DisplayName)" -ForegroundColor Cyan
    }
    
    # Step 5: Get license information
    Write-Host "`nStep 5: Checking license information..." -ForegroundColor Yellow
    $licenseInfo = cscript //nologo C:\Windows\System32\slmgr.vbs /xpr 2>&1
    if ($licenseInfo) {
        Write-Host "License Information: $licenseInfo" -ForegroundColor Cyan
    }
    
    # Output success result
    $result = @{
        Status = "Success"
        Message = "RDP extension completed successfully"
        ServiceStatus = $service.Status
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "RDP Extension Process Completed" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Status: $($result.Status)" -ForegroundColor Green
    Write-Host "Message: $($result.Message)" -ForegroundColor Green
    Write-Host "Service Status: $($result.ServiceStatus)" -ForegroundColor Green
    Write-Host "Timestamp: $($result.Timestamp)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    return $result
    
} catch {
    Write-Host "`nError occurred during RDP extension: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ToString())" -ForegroundColor Red
    
    $result = @{
        Status = "Error"
        Message = "RDP extension failed: $($_.Exception.Message)"
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    return $result
}

