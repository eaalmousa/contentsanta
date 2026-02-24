# Content Santa Manual Pull Auto-Trigger
# This triggers the WordPress plugin to pull jobs every 3 minutes
# Press Ctrl+C to stop

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Content Santa Auto-Pull Trigger" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script triggers WordPress to pull publishing jobs every 3 minutes" -ForegroundColor Yellow
Write-Host "Keep this window open for automatic publishing" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$pullUrl = "https://inert-nonblamefully-dillon.ngrok-free.dev/api/wp/pull"
$secret = "cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg"
$headers = @{
    "X-ContentSanta-Secret" = $secret
}

$count = 0

while ($true) {
    $count++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$timestamp] Pull #$count - Fetching jobs from server..." -ForegroundColor White
    
    try {
        $response = Invoke-RestMethod -Uri $pullUrl -Headers $headers -TimeoutSec 30
        
        if ($response.jobs) {
            $jobCount = $response.jobs.Count
            if ($jobCount -gt 0) {
                Write-Host "[$timestamp] ✅ Received $jobCount job(s) to process" -ForegroundColor Green
                
                # Show job titles
                foreach ($job in $response.jobs) {
                    Write-Host "   → $($job.title)" -ForegroundColor Cyan
                }
            } else {
                Write-Host "[$timestamp] ℹ️  No jobs available (all caught up)" -ForegroundColor Gray
            }
        } else {
            Write-Host "[$timestamp] ℹ️  No jobs in queue" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "[$timestamp] ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "[$timestamp] Waiting 3 minutes until next pull..." -ForegroundColor Gray
    Write-Host ""
    
    Start-Sleep -Seconds 180
}
