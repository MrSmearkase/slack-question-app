# Start the Slack app with visible console output
Write-Host "Starting Slack Question & Response App..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the app" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

cd $PSScriptRoot
node app.js
