param([string]$file, [string]$e)

if ($e) {
    # Inline execution mode
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }
    npx tsx --eval $e
} elseif ($file) {
    # File execution mode
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
        }
    }
    npx tsx $file
} else {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-tsx.ps1 <file.ts>" -ForegroundColor Green
    Write-Host "  .\scripts\run-tsx.ps1 -e '<code>'" -ForegroundColor Green
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-tsx.ps1 test-sanitizer-artifacts.ts"
    Write-Host "  .\scripts\run-tsx.ps1 -e ""console.log('hello')"""
    exit 1
}
