# WordPress Cron Trigger Loop
# Run this to automatically trigger WordPress cron every 3 minutes
# Press Ctrl+C to stop

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WordPress Cron Auto-Trigger" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will trigger WordPress cron every 3 minutes" -ForegroundColor Yellow
Write-Host "Keep this window open for automatic publishing" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$wpCronUrl = "https://gulfestategazette.com/wp-cron.php?doing_wp_cron"
$count = 0

while ($true) {
    $count++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Trigger #$count - Calling WordPress cron..." -ForegroundColor White
    
    try {
        $response = Invoke-WebRequest -Uri $wpCronUrl -UseBasicParsing -TimeoutSec 30
        
        if ($response.StatusCode -eq 200) {
            Write-Host "[$timestamp] ✅ Cron triggered successfully" -ForegroundColor Green
        } else {
            Write-Host "[$timestamp] ⚠️  HTTP $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[$timestamp] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "[$timestamp] Waiting 3 minutes until next trigger..." -ForegroundColor Gray
    Write-Host ""
    
    Start-Sleep -Seconds 180
}
