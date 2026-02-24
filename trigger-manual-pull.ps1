$headers = @{
    "X-ContentSanta-Secret" = "cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg"
}

Write-Host ""
Write-Host "🔄 Triggering WordPress manual pull..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "https://inert-nonblamefully-dillon.ngrok-free.dev/api/wp/pull" -Headers $headers -TimeoutSec 30
    
    if ($response.jobs) {
        Write-Host "✅ Received $($response.jobs.Count) job(s)" -ForegroundColor Green
        
        $response.jobs | ForEach-Object {
            $titlePreview = if ($_.title.Length -gt 60) { $_.title.Substring(0, 60) + "..." } else { $_.title }
            Write-Host "   → $titlePreview" -ForegroundColor White
        }
    } else {
        Write-Host "ℹ️  No jobs available (queue empty)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Now check server console for callback logs!" -ForegroundColor Cyan
Write-Host ""
