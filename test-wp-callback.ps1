# Test WordPress Callback
# This simulates what the WordPress plugin sends after publishing an article

$baseUrl = "https://inert-nonblamefully-dillon.ngrok-free.dev"
$secret = "cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg"

Write-Host "=== Test WordPress Callback ===" -ForegroundColor Cyan
Write-Host ""

# Get a leased job to test with
$headers = @{
    "X-ContentSanta-Secret" = $secret
}

try {
    $pullResponse = Invoke-RestMethod -Uri "$baseUrl/api/wp/pull" -Headers $headers -TimeoutSec 30
    
    if ($pullResponse.jobs -and $pullResponse.jobs.Count -gt 0) {
        $job = $pullResponse.jobs[0]
        
        Write-Host "✅ Got job to test:" -ForegroundColor Green
        Write-Host "   Job ID: $($job.jobId)" -ForegroundColor White
        Write-Host "   Pipeline Item ID: $($job.pipelineItemId)" -ForegroundColor White
        Write-Host "   Lease Token: $($job.leaseToken.Substring(0,20))..." -ForegroundColor White
        Write-Host ""
        
        # Simulate successful publication callback
        $callbackBody = @{
            siteId = $job.siteId
            jobId = $job.jobId
            leaseToken = $job.leaseToken
            ok = $true
            wpPostId = 99999
            wpUrl = "https://gulfestategazette.com/test-callback-article"
            error = $null
            featuredImageError = $null
            warning = $null
        }
        
        Write-Host "📤 Sending callback (simulating WordPress plugin)..." -ForegroundColor White
        
        $callbackResponse = Invoke-RestMethod -Uri "$baseUrl/api/wp/report" -Method POST -Headers $headers -Body ($callbackBody | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 30
        
        if ($callbackResponse.ok) {
            Write-Host "✅ Callback accepted by server!" -ForegroundColor Green
        } else {
            Write-Host "❌ Callback rejected: $($callbackResponse.error)" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "🔍 Verifying pipeline item was updated..." -ForegroundColor White
        
        # Check if pipeline item was updated
        Write-Host "   Run this to verify:" -ForegroundColor Yellow
        Write-Host "   npx tsx --env-file=.env -e `"import { db } from './server/db'; import { pipelineItems } from './shared/schema'; import { eq } from 'drizzle-orm'; (async () => { const item = await db.select().from(pipelineItems).where(eq(pipelineItems.id, '$($job.pipelineItemId)')); console.log('Status:', item[0]?.status, 'Post ID:', item[0]?.targetPostId); process.exit(0); })();`"" -ForegroundColor Gray
        
    } else {
        Write-Host "ℹ️  No jobs available to test with" -ForegroundColor Yellow
        Write-Host "   Wait for publishing worker to create new jobs" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
