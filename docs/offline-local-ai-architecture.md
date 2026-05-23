# Technical Architecture: Fully Offline Local AI System with Ollama + Autonomous Agents

**Project Context**: VellonCVs (and future extensions)  
**Design Date**: May 2026  
**Environment**: Completely air-gapped (no internet, no cloud dependencies)  
**Core Principle**: All intelligence runs locally using open-source models via Ollama. Zero data leaves the machine.

---

## 1. Executive Summary

This architecture describes a **fully offline, air-gapped local AI system** where **Ollama** serves as the central LLM inference engine. The system extends beyond simple chat by orchestrating **specialized autonomous agents** that collaborate to solve complex tasks.

Key specialized agents:
- **Computer Vision (CV) Agent**: Handles visual input (scanned PDFs, images, screenshots, diagrams).
- **Corrective / Redo Agent**: Performs self-critique, error detection, and iterative refinement ("redo" loops).

The design emphasizes:
- Low-latency local communication
- Robust agent orchestration
- Complete privacy and air-gapped operation
- Extensibility for resume optimization (VellonCVs use case), document understanding, code review, etc.

---

## 2. Core Design Principles

1. **Ollama as the Single Source of Truth for Intelligence**
   - All reasoning, tool use, vision, and generation go through Ollama's OpenAI-compatible or native API.
   - Multiple specialized models can run simultaneously.

2. **Agentic but Lightweight**
   - Agents are not heavy separate processes unless necessary.
   - Preference for **in-process orchestration** for lowest latency.

3. **Air-Gapped First**
   - Every component must work with pre-downloaded models and local-only dependencies.
   - No external API calls ever.

4. **Low-Latency Communication**
   - Minimize serialization overhead.
   - Prefer shared memory / in-process calls over even localhost HTTP when possible.
   - Warm model loading + persistent context where safe.

5. **Iterative Self-Correction**
   - The Corrective Agent is always in the loop for high-stakes outputs (resumes, reports, code).

---

## 3. Component Stack (Air-Gapped Ready)

### 3.1 Inference Layer (Foundation)
- **Ollama** (latest 2026 build)
  - Primary engine on `http://localhost:11434`
  - Recommended models (pre-pulled):
    - Text/Reasoning: `llama3.1:8b`, `qwen2.5:14b`, `phi4:14b`
    - Vision/Multimodal: `llava:13b`, `minicpm-v:8b`, `llama3.2-vision:11b`
    - Embedding: `nomic-embed-text` or `mxbai-embed-large`
    - Fast small models for routing/critique: `phi3:mini` or `gemma2:2b`

- **GPU Acceleration** (optional but recommended for speed):
  - NVIDIA CUDA, AMD ROCm, or Apple Metal (via Ollama)

### 3.2 Agent Orchestration Layer
- **Primary Choice**: Custom **LangGraph-style State Machine** (Python) or **pure Python async orchestrator**
  - Why not heavy frameworks? Lower overhead in air-gapped env.
  - Alternative (if more structure needed): Local **CrewAI** or **AutoGen** (fully vendored).

- **Orchestrator Agent** (main LLM):
  - Decides task type
  - Routes to specialized agents
  - Manages conversation state and redo loops

### 3.3 Specialized Agents

#### A. Computer Vision (CV) Agent
- **Multimodal LLM**: `llava` or `minicpm-v` via Ollama
- **Supporting Local Tools** (all offline):
  - OCR: Tesseract (pre-installed language packs) or EasyOCR (local weights)
  - PDF/Image processing: `pymupdf` (fitz), `pdf2image` (poppler local), `PIL`
  - Layout analysis: Local rule-based + vision model
- **Responsibilities**:
  - Extract text + structure from scanned/image-based resumes/PDFs
  - Describe diagrams, charts, or screenshots
  - Answer visual questions ("What is the experience timeline in this image?")

#### B. Corrective / Redo Agent
- **Dedicated Critique Model**: Smaller fast model (`phi4` or `qwen2.5:7b`) for speed
- **Responsibilities**:
  - Review output against strict criteria (truthfulness, ATS compliance, quantification, no hallucination)
  - Generate structured feedback: "Redo needed because: missing metrics, weak verb, keyword gap"
  - Trigger controlled redo loops (max 3 iterations by default)

#### C. Optional Future Agents (Extensible)
- Research Agent (local RAG over user documents)
- Formatting Agent (LaTeX / DOCX rendering)
- Validation Agent (ATS simulation using local heuristics + LLM)

### 3.4 Communication & Orchestration Layer (Low-Latency Focus)

**Primary Pattern: In-Process Agent Loop (Recommended for Air-Gapped)**

```
[Next.js Frontend]
        ↓ (localhost HTTP)
[Python Orchestrator Service]  ← FastAPI on localhost:8000
        ↓ (direct Python function calls)
[Agent Registry]
   ├── Vision Agent (Ollama + local tools)
   ├── Corrective Agent (Ollama)
   └── Main Execution Agent (Ollama)
```

**Communication Methods Ranked by Latency (Air-Gapped)**:

1. **In-Process / Same Python Process** (best)
   - Direct function calls + shared Python objects
   - Zero serialization cost
   - Use `asyncio` + queues for concurrency

2. **Local Unix Domain Sockets** or **Named Pipes** (Windows)
   - Extremely fast IPC

3. **Localhost HTTP / gRPC** (FastAPI + uvicorn or grpcio)
   - Still very low latency (< 2ms overhead)
   - Easy to scale to micro-agents if needed
   - Use JSON or Protocol Buffers

4. **Local Message Queue** (Redis local or RabbitMQ local)
   - Only if you need persistence or multiple workers
   - Adds ~5-15ms overhead

**Avoid**:
- Any cloud or external network calls
- Heavy serialization (avoid pickle across processes if possible)

### 3.5 Supporting Components

- **Local Vector Store** (if RAG needed): ChromaDB or FAISS (file-based, no server)
- **State Management**: Pydantic models + SQLite (for conversation history, agent memory)
- **Tool Calling**: Native Ollama tool support (structured JSON)
- **Output Validation**: Pydantic + custom critique schemas
- **Frontend Integration**: Existing Next.js app calls the Orchestrator via `/api/agents/...`

---

## 4. Data Flow (End-to-End)

### Example Flow: User uploads a scanned resume image + asks for optimization

1. **User Action** (Frontend)
   - Uploads image/PDF → Next.js sends to Orchestrator

2. **Orchestrator Receives Task**
   - Classifies: "Vision required + Text refinement"
   - Initializes shared state (Pydantic `TaskState`)

3. **CV / Vision Agent Activated**
   - Sends image + prompt to `llava` via Ollama
   - Runs local OCR + layout analysis
   - Outputs structured data: `ExtractedResume { sections, raw_text, visual_notes }`
   - Stores result in shared state

4. **Main Execution Agent**
   - Takes structured data + user goal
   - Generates initial rewrite using primary model (`llama3.1:8b`)
   - Produces candidate output

5. **Corrective / Redo Agent**
   - Receives candidate + original extracted data + rules
   - Runs critique pass:
     - Hallucination check
     - ATS keyword coverage
     - Quantification & verb strength
     - Truthfulness vs source
   - If score < threshold → generates `RedoInstructions` and loops back to step 4 (max iterations: 3)

6. **Final Output**
   - Orchestrator packages result + audit trail (what was redone and why)
   - Returns to frontend with "Before/After" + confidence score

**State Object Example** (passed between agents):

```python
class TaskState(BaseModel):
    task_id: str
    user_goal: str
    original_input: Any
    vision_output: Optional[VisionResult] = None
    current_draft: Optional[str] = None
    critique_history: list[Critique] = []
    final_output: Optional[str] = None
    iterations: int = 0
```

---

## 5. Ensuring Low-Latency in Air-Gapped Environment

### Model Management
- Use `OLLAMA_KEEP_ALIVE=-1` (or very high) so models stay in VRAM/GPU memory
- Prefer 4-bit/5-bit quantized models for speed/quality balance
- Load multiple models concurrently (Ollama supports this well in 2026)

### Communication Optimizations
- **In-process agents** when possible (single Python process with async tasks)
- Use **structured tool calling** instead of free text parsing (faster + more reliable)
- Batch non-urgent operations
- Cache embeddings and frequent sub-tasks locally (Chroma + LRU)

### Prompt & Context Engineering
- Keep system prompts tight
- Use **context compression** before handing to corrective agent
- Limit max tokens per agent turn

### Hardware Recommendations (for < 3s response on typical tasks)
- 16GB+ RAM minimum
- NVIDIA GPU with 8GB+ VRAM (RTX 4060 or better) for comfortable multimodal + reasoning
- SSD storage for model files

### Monitoring (Local Only)
- Simple logging to SQLite
- Latency tracking per agent step (for tuning)

---

## 6. Implementation Roadmap (for VellonCVs)

**Phase 1** (Current)
- Basic Ollama chat (already implemented)
- Simple file upload

**Phase 2** (Next)
- Add Python Orchestrator service (FastAPI on localhost)
- Implement CV Agent using `llava` for scanned resumes
- Basic Corrective Agent with 1 redo loop

**Phase 3**
- Full multi-agent state machine (LangGraph or custom)
- Vision + text + critique full pipeline
- Export with audit trail

**Phase 4**
- Local RAG over user's past optimized resumes
- Multiple parallel corrective passes (ensemble critique)

---

## 7. Security & Air-Gap Considerations

- All models pre-downloaded and verified (checksums)
- No `pip install` at runtime — everything vendored or pre-installed
- Strict output sanitization before any rendering
- Conversation state never leaves local disk
- Optional: Full-disk encryption on the machine

---

## 8. Conclusion

This architecture gives VellonCVs (and similar tools) **true agentic power** while remaining 100% private and offline. By keeping Ollama as the central brain and using lightweight, specialized agents with in-process communication, we achieve both high capability and excellent responsiveness even in completely air-gapped environments.

The combination of a strong Vision Agent + a relentless Corrective Agent creates a system that can handle real-world messy inputs (scanned documents) and self-improve its outputs through iteration — all without ever phoning home.

---

**Next Steps Recommendation**:
1. Implement the Python Orchestrator as a separate localhost service.
2. Add the "Check connection again" retry (already done in UI).
3. Start with the CV Agent for image-based resume uploads — this directly solves a major pain point in resume optimization.

This design is ready for implementation and can be extended modularly as new local models and capabilities become available.
