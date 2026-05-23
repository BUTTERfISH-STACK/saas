# Troubleshooting Vellon Core Connection Issues

**Symptom:**  
The app shows errors such as:

- "Vellon Core unavailable"
- "The private AI engine is not responding"
- Model list is empty or shows placeholder names
- Chat requests fail with connection errors

This happens when the **Vellon Core** (the local private AI inference service) is not running or not reachable on your machine.

---

## Step 1: Quick Verification (30 seconds)

### Option A — Using your browser (easiest)

1. Open a new browser tab.
2. Go to this address:  
   **http://localhost:11434/api/tags**

**Expected result if healthy:**
- You see a JSON response that looks like:
  ```json
  {"models": [{"name": "llama3.1:8b", ...}]}
  ```

**If you see "This site can’t be reached" or connection refused:**
→ The Vellon Core service is **not running**.

---

### Option B — Using Command Line (PowerShell or Terminal)

Open **PowerShell** (recommended on Windows) or Git Bash / Terminal.

Run this command:

```powershell
# Check if the service is listening on the correct port
netstat -ano | findstr :11434
```

**Healthy output** will show something like:
```
TCP    0.0.0.0:11434          0.0.0.0:0              LISTENING       12345
```

If you see no output, the service is not running.

---

## Step 2: Start the Vellon Core Service

### If you have never installed it

1. Download the official installer from the provider’s website (search for the latest local AI runtime installer for your platform).
2. Run the installer and complete the setup.
3. After installation, the service should start automatically in the background.

### Starting / Restarting the service manually

1. Open **PowerShell** or **Command Prompt** as a regular user.
2. Run the following command:

```powershell
ollama serve
```

You should see output similar to:
```
time=... level=INFO msg="Listening on [::]:11434"
```

**Important:**
- Leave this terminal window **open** while using VellonCVs.
- The service runs on port 11434 by default.

### On Windows — Run it persistently (recommended)

**Method 1: Simple (keep terminal open)**  
Just run `ollama serve` and minimize the window.

**Method 2: Create a startup shortcut (best for daily use)**

1. Press `Win + R`, type `shell:startup`, press Enter.
2. Right-click → New → Shortcut.
3. Enter this as the target:
   ```
   powershell -WindowStyle Hidden -Command "ollama serve"
   ```
4. Name it “Vellon Core” and finish.

Now it will start automatically when you log into Windows.

---

## Step 3: Pull a Base Model (Required First Time)

Even if the service is running, you need at least one intelligence model.

In the same terminal, run:

```powershell
ollama pull llama3.1:8b
```

This downloads the default high-quality model (~4–5 GB). It only needs to be done once.

You can also pull lighter or stronger models later:
- `ollama pull phi4` (fast)
- `ollama pull qwen2.5:14b` (stronger)

After pulling, refresh the VellonCVs page — the model selector should now show real models.

---

## Step 4: Verify Everything Works

1. Go back to **http://localhost:11434/api/tags** in your browser.
2. You should now see your pulled models listed.
3. Refresh the VellonCVs application (http://localhost:3000).
4. The status indicator in the sidebar should show **“Vellon Intelligence”** (green dot).
5. Try sending a simple message in the chat.

---

## Running the Full Agentic System (Vision + Corrective/Redo Agents)

The advanced architecture (Orchestrator + CV Vision Agent + Corrective Redo Agent) requires the Python backend.

### Start the Vellon Core Agent Orchestrator

```powershell
# In a new terminal
cd backend
.\venv\Scripts\Activate.ps1     # Windows
# or source venv/bin/activate   # Git Bash / macOS / Linux

uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Test the Agents

- Visit http://localhost:8000/docs for interactive API docs (Swagger)
- Or use the new **"Run Full Agent Pipeline"** button in the VellonCVs sidebar / quick actions after uploading a resume (especially images/scans for the Vision Agent)

### Required Models for Full Experience

```powershell
ollama pull llava:13b          # or minicpm-v for Vision Agent
ollama pull phi4:14b           # Fast critique model for Redo Agent
ollama pull llama3.1:8b        # Main reasoning model
```

Once the Python backend is running, the "Core offline" status can be bypassed for advanced tasks by using the orchestrator endpoints directly.

---

## Step 5: Common Problems & Fixes

| Problem | Cause | Solution |
|---------|-------|----------|
| Port 11434 already in use | Another program is using the port | Kill the conflicting process or change the port (advanced) |
| Windows Firewall / Antivirus blocking | Security software blocking localhost traffic | Add an exception for `ollama.exe` |
| `ollama` command not found | Service not installed or not in PATH | Re-run the installer and restart your terminal |
| Model not found error in chat | You selected a model that isn't pulled | Pull the model first with `ollama pull <name>` |
| Very slow responses | No GPU or insufficient RAM | Use a smaller model (`phi4`, `llama3.2:3b`) or ensure NVIDIA GPU drivers are installed |
| Service crashes after some time | Resource limits | Restart with `ollama serve` again |
| Running on a different machine / port | Custom setup | Set environment variable in `.env.local`:<br>`OLLAMA_BASE_URL=http://your-ip:11434` |

---

## Advanced: Environment Configuration

Create a file called `.env.local` in the project root:

```env
# Point VellonCVs to a custom Vellon Core location
OLLAMA_BASE_URL=http://localhost:11434
```

Then restart the Next.js dev server (`npm run dev`).

---

## Still Not Working?

1. Restart your computer (clears most port conflicts).
2. Confirm `ollama --version` works in terminal.
3. Check the terminal where you ran `ollama serve` for any red error messages.
4. Open an issue with the exact error message you see in the browser console (F12 → Console tab).

---

**VellonCVs** is designed to run completely privately on your hardware. Once the local Vellon Core service is running and has at least one model, the application will work reliably with zero cloud dependency.

Need help? The commands above are all you need in 95% of cases.
