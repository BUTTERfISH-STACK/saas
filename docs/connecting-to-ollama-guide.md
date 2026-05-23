# Connecting to a Local Ollama Instance - Technical Guide

This guide provides step-by-step instructions and ready-to-use scripts to establish and verify a connection to an **Ollama** instance (the local AI engine used by VellonCVs).

All steps assume a completely local, air-gapped environment.

---

## 1. Prerequisites

- Ollama installed on your machine
- At least one model pulled (e.g. `llama3.1:8b`)
- VellonCVs project running (`npm run dev`)
- (Optional) Python backend for full agent features

---

## 2. Step-by-Step: Starting and Connecting to Ollama

### Step 1: Start the Ollama Server

**Windows (PowerShell or Command Prompt):**

```powershell
ollama serve
```

You should see output like:
```
time=2026-05-23... level=INFO msg="Listening on [::]:11434 (http)"
```

**Important:** Leave this terminal window open. Ollama runs as a local HTTP server on port **11434**.

**Run persistently on Windows startup (recommended):**

1. Press `Win + R`, type `shell:startup`, press Enter.
2. Create a shortcut with target:
   ```
   powershell -WindowStyle Hidden -Command "ollama serve"
   ```

### Step 2: Verify Ollama is Running (Basic Check)

Open a **new** PowerShell window and run:

```powershell
curl http://localhost:11434/api/tags
```

**Expected successful response:**
```json
{"models":[{"name":"llama3.1:8b", ...}]}
```

If you get `Connection refused` or timeout → Ollama is not running.

### Step 3: Pull a Model (First Time Only)

```powershell
ollama pull llama3.1:8b
```

Other good models for VellonCVs:
- `ollama pull phi4:14b` (fast critique)
- `ollama pull llava:13b` (for Vision Agent / scanned resumes)

---

## 3. Verification Scripts

### PowerShell Verification Script (Recommended)

Save this as `scripts/verify-ollama.ps1` and run it anytime:

```powershell
# scripts/verify-ollama.ps1

Write-Host "=== VellonCVs - Ollama Connection Verification ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check if Ollama process is running
$process = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "✓ Ollama process is running (PID: $($process.Id))" -ForegroundColor Green
} else {
    Write-Host "✗ Ollama process NOT found. Run: ollama serve" -ForegroundColor Red
    exit 1
}

# 2. Test HTTP endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 5
    Write-Host "✓ Ollama API is responsive on port 11434" -ForegroundColor Green
    
    if ($response.models -and $response.models.Count -gt 0) {
        Write-Host "✓ Models available:" -ForegroundColor Green
        $response.models | ForEach-Object { 
            Write-Host "   - $($_.name)" -ForegroundColor Gray 
        }
    } else {
        Write-Host "⚠ No models found. Run: ollama pull llama3.1:8b" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Cannot reach Ollama API: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure 'ollama serve' is running in another terminal." -ForegroundColor Yellow
    exit 1
}

# 3. Quick chat test (optional)
Write-Host ""
Write-Host "Testing simple generation..." -ForegroundColor Cyan
try {
    $testBody = @{
        model = "llama3.1:8b"
        prompt = "Say 'Connection successful' in one sentence."
        stream = $false
    } | ConvertTo-Json

    $chatResponse = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "✓ Generation test passed" -ForegroundColor Green
    Write-Host "   Response: $($chatResponse.response)" -ForegroundColor Gray
} catch {
    Write-Host "⚠ Generation test failed (may still work for chat)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
```

**How to run:**
```powershell
.\scripts\verify-ollama.ps1
```

### Node.js / Next.js Verification (for Developers)

You can also run this directly inside the project:

```bash
node -e "
const https = require('http');

https.get('http://localhost:11434/api/tags', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('✓ Ollama connected');
    console.log('Models:', json.models?.map(m => m.name).join(', ') || 'none');
  });
}).on('error', (err) => {
  console.error('✗ Connection failed:', err.message);
});
"
```

### Python Verification (for the Agent Backend)

```python
import ollama

try:
    client = ollama.Client(host="http://localhost:11434")
    models = client.list()
    print("✓ Ollama connected successfully")
    print("Available models:")
    for m in models.get("models", []):
        print(f"  - {m['name']}")
except Exception as e:
    print(f"✗ Failed to connect: {e}")
```

---

## 4. Connecting from VellonCVs (Next.js)

VellonCVs connects to Ollama in two places:

### A. Direct Chat (Current UI)
- `app/api/chat/route.ts` → calls `http://localhost:11434/api/chat`
- `app/api/models/route.ts` → calls `http://localhost:11434/api/tags`

**Environment variable override** (optional):
Create `.env.local` in project root:
```env
OLLAMA_BASE_URL=http://localhost:11434
```

### B. Full Agentic System (Python Orchestrator)
The Python backend (`backend/main.py`) also uses the same Ollama host.

You can change it in `backend/ollama_client.py`:
```python
def __init__(self, host: str = "http://localhost:11434"):
```

---

## 5. Common Issues & Quick Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Core offline" in UI | Stale React state | Hard refresh (`Ctrl+Shift+R`) or click **↻ Check connection again** |
| Connection refused | `ollama serve` not running | Start Ollama in a separate terminal |
| No models listed | No models pulled | `ollama pull llama3.1:8b` |
| Slow responses | Large model + no GPU | Use smaller model (`phi4`, `llama3.2:3b`) |
| Port 11434 in use | Another Ollama instance | Kill process or change port (advanced) |
| Python backend can't reach Ollama | Wrong host in `ollama_client.py` | Update host to `http://localhost:11434` |

---

## 6. Quick One-Liner Verification

**PowerShell:**
```powershell
curl http://localhost:11434/api/tags -UseBasicParsing | ConvertFrom-Json | Select-Object -ExpandProperty models | Select-Object name
```

**Bash / Git Bash:**
```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

---

## 7. Summary Checklist

1. Run `ollama serve` in one terminal
2. Run `ollama pull llama3.1:8b` (if first time)
3. Run the verification script: `.\scripts\verify-ollama.ps1`
4. Start VellonCVs: `npm run dev`
5. Click **↻ Check connection again** in the sidebar
6. (Optional) Start Python agents: `npm run agents`

Once the verification script reports success, your VellonCVs instance will be fully connected to the local Ollama engine.

---

**Last updated:** 2026-05-23
**For VellonCVs project**
