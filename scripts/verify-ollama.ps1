# scripts/verify-ollama.ps1
# VellonCVs - Ollama Connection Verification Script
# Run this anytime to check if your local AI engine is healthy

Write-Host "=== VellonCVs - Ollama Connection Verification ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Ollama process is running
$process = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "✓ Ollama process is running (PID: $($process.Id))" -ForegroundColor Green
} else {
    Write-Host "✗ Ollama process NOT found." -ForegroundColor Red
    Write-Host "  Please run: ollama serve  (in another terminal)" -ForegroundColor Yellow
    exit 1
}

# 2. Test HTTP endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Ollama API is responsive on port 11434" -ForegroundColor Green
    
    if ($response.models -and $response.models.Count -gt 0) {
        Write-Host "✓ Models available:" -ForegroundColor Green
        $response.models | ForEach-Object { 
            Write-Host "   - $($_.name)" -ForegroundColor Gray 
        }
    } else {
        Write-Host "⚠ No models found." -ForegroundColor Yellow
        Write-Host "  Run: ollama pull llama3.1:8b" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Cannot reach Ollama API: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure 'ollama serve' is running in another terminal window." -ForegroundColor Yellow
    exit 1
}

# 3. Quick generation test
Write-Host ""
Write-Host "Testing simple generation (this may take a few seconds)..." -ForegroundColor Cyan
try {
    $testBody = @{
        model = "llama3.1:8b"
        prompt = "Reply with exactly this sentence: Connection to Ollama is working correctly."
        stream = $false
    } | ConvertTo-Json -Depth 2

    $chatResponse = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 60
    
    Write-Host "✓ Generation test passed" -ForegroundColor Green
    Write-Host "   Response: $($chatResponse.response.Trim())" -ForegroundColor Gray
} catch {
    Write-Host "⚠ Generation test failed or timed out." -ForegroundColor Yellow
    Write-Host "  The chat endpoint may still work." -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Verification Complete - Ollama is ready for VellonCVs ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Start VellonCVs: npm run dev" -ForegroundColor Gray
Write-Host "  2. In the app, click '↻ Check connection again'" -ForegroundColor Gray
Write-Host "  3. (Optional) Start full agent backend: npm run agents" -ForegroundColor Gray
