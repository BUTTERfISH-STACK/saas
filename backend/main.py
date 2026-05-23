from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from backend.agents.orchestrator import AgentOrchestrator
from backend.schemas import TaskState, AgentResponse, VisionRequest
import tempfile
import os
from typing import Optional
import json

app = FastAPI(
    title="Vellon Core - Offline Agent Orchestrator",
    description="Fully local, air-gapped agentic AI system powered by Ollama",
    version="1.0.0"
)

# Allow Next.js frontend (localhost:3000) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = AgentOrchestrator()

@app.get("/health")
async def health():
    """Quick health check for the orchestrator and Ollama"""
    ollama_ok = orchestrator.ollama.is_available()
    models = orchestrator.ollama.list_models() if ollama_ok else []
    return {
        "status": "healthy" if ollama_ok else "degraded",
        "ollama_connected": ollama_ok,
        "available_models": [m.get("name") for m in models[:5]] if models else [],
        "vision_agent_ready": True,
        "corrective_agent_ready": True
    }

@app.post("/agents/vision", response_model=AgentResponse)
async def vision_agent(file: UploadFile = File(...), prompt: str = Form(...)):
    """CV / Computer Vision Agent - Process uploaded resume images or PDFs"""
    if not file:
        raise HTTPException(400, "No file uploaded")
    
    # Save temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        vision_req = VisionRequest(prompt=prompt)
        result = orchestrator.vision_agent.process_resume_image(vision_req, image_path=tmp_path)
        
        return AgentResponse(
            success=result.get("success", False),
            data=result,
            message="Vision processing complete" if result.get("success") else "Vision failed"
        )
    finally:
        os.unlink(tmp_path)

@app.post("/agents/corrective", response_model=AgentResponse)
async def corrective_agent(draft: str = Form(...), context: str = Form(...)):
    """Corrective / Redo Agent - Critique and suggest improvements"""
    critique_req = CritiqueRequest(draft=draft, original_context=context)
    critique = orchestrator.corrective_agent.critique_output(critique_req)
    
    return AgentResponse(
        success=True,
        data=critique,
        critique_feedback=critique.get("feedback")
    )

@app.post("/orchestrate/resume", response_model=AgentResponse)
async def orchestrate_resume_optimization(
    goal: str = Form(...),
    resume_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    job_description: Optional[str] = Form(None)
):
    """
    Full Orchestrator Pipeline:
    1. Vision Agent (if image uploaded)
    2. Main LLM generation
    3. Corrective Agent + Redo loop
    """
    task = orchestrator.create_task(user_goal=goal)
    
    image_path = None
    if file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            tmp.write(await file.read())
            image_path = tmp.name
    
    try:
        result = orchestrator.process_resume_optimization(
            task=task,
            resume_text_or_image=resume_text,
            image_path=image_path,
            job_description=job_description
        )
        return result
    finally:
        if image_path and os.path.exists(image_path):
            os.unlink(image_path)

@app.get("/models")
async def get_available_models():
    """List models available in the local Ollama instance"""
    models = orchestrator.ollama.list_models()
    return {"models": [m.get("name") for m in models] if models else []}

@app.post("/models/pull")
async def pull_ollama_model(model: str = Form(...)):
    """
    Pull (download) a free open-source Ollama model via the FastAPI core.
    This allows managing local Ollama models through the Vellon Core.
    Example: model = "llama3.2:3b"
    """
    result = orchestrator.ollama.pull_model(model)
    if result.get("success"):
        return result
    else:
        return {"success": False, "error": result.get("error", "Unknown error pulling model")}

@app.post("/chat")
async def chat(request: Request):
    """
    Streaming chat endpoint that connects to local Ollama via the FastAPI core.
    This allows the Vercel frontend (or any frontend) to use the local Ollama models
    by calling this public FastAPI endpoint.
    """
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", "llama3.2:3b")

    async def stream_response():
        try:
            # Use the ollama client with stream
            response = orchestrator.ollama.client.chat(
                model=model,
                messages=messages,
                stream=True
            )
            for chunk in response:
                if "message" in chunk and "content" in chunk["message"]:
                    content = chunk["message"]["content"]
                    if content:
                        yield f"0:{json.dumps(content)}\n"
            yield 'd:{"finishReason":"stop"}\n'
        except Exception as e:
            yield f'0:{json.dumps(f"Error: {str(e)}")}\n'
            yield 'd:{"finishReason":"error"}\n'

    return StreamingResponse(stream_response(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
