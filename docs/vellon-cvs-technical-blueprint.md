# VellonCVs — Technical Blueprint & Implementation Guide

**VellonCVs** is a privacy-first, web-based conversational AI application (ChatGPT-like interface) that leverages **Ollama** as the local LLM backend to deliver automated CV/resume rewriting, optimization, ATS scoring, and job-tailoring services.

All processing happens locally: user data never leaves the machine. The conversational interface allows iterative refinement ("improve the summary", "make bullets quantifiable for a Staff Engineer role", "align with this JD").

**Version**: 1.0 (May 2026)  
**Target Users**: Job seekers, career coaches, recruiters, privacy-conscious professionals  
**Core Value**: Professional-grade, truthful, ATS-optimized CVs in minutes using local AI — zero subscriptions, zero data leakage.

---

## 1. Executive Summary & Goals

- Deliver a polished, production-ready web experience comparable to ChatGPT/Claude but specialized for CV optimization.
- Use **Ollama** exclusively for inference (OpenAI-compatible `/v1` or native API).
- Support major resume formats: PDF, DOCX (primary); TXT/MD fallback.
- Multi-stage, validated LLM pipeline (not naive single-prompt rewrite) to minimize hallucinations and ensure ATS compatibility.
- Conversational control: upload once → chat to iterate → export polished versions.
- Self-hostable via Docker; optionally desktop-wrapped (Tauri).
- Extensible to RAG over past optimized CVs, job-description libraries, and multi-model comparison.

**Non-Goals (MVP)**: Cloud sync, collaborative editing, advanced analytics dashboard, mobile native app.

---

## 2. Key Features

**Conversational Experience**
- Real-time streaming responses (token-by-token typing effect).
- Chat history with auto-titles, branching, search.
- Context-aware of uploaded CV(s) and optional Job Descriptions (JDs).
- Tool calling: user can trigger structured actions ("/optimize", "/ats-score", "/tailor", "/rewrite-section").

**CV Processing & Optimization**
- Intelligent parsing → structured Canonical Resume Data Model (CRDM) based on JSON Resume schema + extensions.
- Optional JD upload/paste → Canonical Job Description Model (CJDM).
- Gap analysis (deterministic + LLM).
- Modular rewrite engine with per-section prompts, Zod validation, self-correction retries.
- ATS keyword optimization, action-verb enforcement, quantification suggestions, length control.
- Before/after diff view + side-by-side preview.

**Export & Quality**
- Professional PDF via LaTeX (recommended for typography) or modern alternatives (React-PDF, WeasyPrint, Pandoc).
- DOCX and clean Markdown export.
- ATS compatibility report (score 0-100 with breakdown: keywords, structure, parsability, content quality).
- Version history and "restore previous" in chat.

**Privacy & Local-First**
- 100% local by default.
- Optional hybrid: fallback to cloud providers via Vercel AI SDK (same code path).

---

## 3. Recommended Technology Stack (2026)

### Frontend (Modern, Type-Safe, AI-Native)
- **Next.js 16** (App Router, React Server Components, Turbopack)
- **TypeScript** (strict)
- **Tailwind CSS 4** + **shadcn/ui** (or Radix + custom) + **lucide-react** icons
- **Vercel AI SDK** (`ai`, `@ai-sdk/react`, `ollama-ai-provider` or `@ai-sdk/openai` against Ollama `/v1`)
  - `useChat` hook for streaming, message history, tool calling, loading states.
- **Framer Motion** for smooth transitions/animations in chat and previews.
- **React Hook Form** + **Zod** for any forms (JD paste, settings).
- **TanStack Table / Query** (optional, for history or version management).
- **Sonner** or **Radix Toast** for notifications.
- **React-PDF** or **@react-pdf/renderer** for client-side preview (with server-generated authoritative PDF).

**Why Next.js?** Zero-config API routes for Ollama proxy, excellent DX with AI SDK, easy deployment, full-stack TypeScript.

### Backend / API Layer
- **Next.js API Routes + Server Actions** (primary — keeps everything in one repo).
- Optional lightweight **FastAPI** (Python) microservice only if heavy document parsing/OCR or LaTeX compilation is preferred in Python. Use only if Node parsing proves insufficient.
- **Streaming**: NDJSON or Vercel AI SDK data stream protocol.

### LLM & Ollama Integration
- **Ollama** (latest) — primary runtime.
  - Recommended models (2026):
    - Primary: `llama3.1:8b` or `llama3.3:70b` (or Qwen2.5-14B/32B) for balance of speed/quality.
    - Structured output / tool calling: `llama3.1`, `qwen2.5`, `phi4`, `mistral-nemo`.
    - Vision (scanned PDFs): `llava`, `qwen2-vl`, `llama3.2-vision`.
- **Vercel AI SDK** providers:
  - `createOllama()` (community) for native options (num_ctx, mirostat, embeddings).
  - Or standard OpenAI provider pointing at `http://localhost:11434/v1`.
- **Tool Calling** enabled for actions: `parse_resume`, `analyze_gaps`, `rewrite_section`, `generate_ats_report`.
- System prompts + conversation memory managed server-side (never trust client).
- Temperature: 0.3–0.5 for analysis/rewrites (focused), 0.7 for creative phrasing suggestions.

**Hybrid Mode** (optional): Same SDK code switches to `openai('gpt-4o-mini')` or Anthropic when local GPU unavailable.

### Document Parsing & Extraction (Critical for Accuracy)
**Node.js-first (recommended for unified stack)**:
- **PDF**: `pdfjs-dist` (spatial/layout-aware) + `@opendataloader/pdf` (best-in-class 2026 benchmarks, bounding boxes, hybrid AI mode) or `pdf-parse` (simple) + Tesseract.js for OCR fallback.
- **DOCX**: `docx-parser` (modern streaming, checkbox/footnote aware) or `mammoth` + `docx`.
- **Advanced/LLM-assisted structured extraction**: `resume-intel` (or similar) — spatial + per-section LLM calls with Zod + self-correction. Perfect complement to our pipeline.
- **Unified parser abstraction**: Create `lib/parsers/resume-parser.ts` with strategy pattern (fast vs accurate vs vision).

**Python alternative** (if chosen): `pypdf`/`pdfplumber` + `python-docx` + `unstructured` + `pytesseract` + FastAPI endpoint.

**Output Target**: Always convert to **Canonical Resume Data Model** (JSON Resume v1 + custom fields: `metrics`, `keywords`, `versions`).

### Structured Data, Validation & State
- **Zod** schemas everywhere for LLM output (CRDM, CJDM, RewritePlan, RewrittenBullet, ATSReport).
- `jsonrepair` + retry loops on parse failure.
- In-memory conversation context (with truncation strategy) + optional persistence.

### Persistence & Auth (MVP → Production)
- **MVP**: `better-sqlite3` or **Drizzle ORM + SQLite** (file-based, zero config). Or **Prisma + PostgreSQL** (Docker).
- Store: Users, Conversations (messages + attachments metadata), CV versions (structured JSON + original file hash), Exports.
- **Auth** (progressive):
  - MVP: Anonymous sessions (localStorage + server session) or passwordless magic links.
  - Production: **NextAuth.js v5** (or Auth.js) with credentials, Passkeys, or OAuth (Google/GitHub) + JWT.
- File storage: `data/uploads/{userId}/{hash}.pdf` + metadata in DB. Never store raw PII beyond what user uploads.

### Export & Rendering
- **PDF (gold standard)**: LaTeX templates (`sb2nov/resume` or modern `moderncv` / custom) + `tectonic` or `pdflatex` (fast, beautiful typography). Or Node `pdfkit` / `@react-pdf/renderer`.
- **DOCX**: `docx` library (template-based).
- **Markdown**: Simple, for version control / ATS text.
- **ATS-safe mode**: Plain .txt or .docx with strict formatting rules (no tables, no graphics, standard headings).

### Observability, Rate Limiting, DevOps
- **Logging**: Pino or Winston (structured).
- **Error tracking**: Sentry (self-hostable) or OpenTelemetry.
- **Rate limiting** (per user/IP) on chat endpoints using `upstash/ratelimit` or simple in-memory + Redis (optional).
- **Docker Compose**: `ollama` + `velloncvs` (Next.js) + `postgres` (optional) + `nginx` / Caddy for TLS + WebSocket.
- **Monitoring**: Prometheus + Grafana for Ollama GPU/queue metrics.
- **Model management**: UI to `ollama list` / pull via API proxy.

**Alternative Full-Stack Options** (if not Next.js):
- Python: **Reflex** (pure-Python reactive UI + streaming WebSockets) — excellent for data-heavy apps.
- Hybrid: Next.js FE + FastAPI BE (seen in several 2026 Ollama stacks like "breeze").

**Why this stack wins in 2026**:
- Vercel AI SDK removes 80% of streaming/tool boilerplate.
- Ollama OpenAI compatibility = future-proof (easy cloud fallback).
- Next.js = best-in-class DX and deployment.
- Local-first + structured pipelines = trustworthy professional output.

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                     │
│  ┌──────────────┐  ┌─────────────────────────────┐          │
│  │  Sidebar     │  │   Chat Interface (useChat)  │          │
│  │  - History   │  │   - Streaming messages      │          │
│  │  - Files     │  │   - File upload (CV/JD)     │          │
│  │  - Models    │  │   - Action buttons (/tools) │          │
│  └──────────────┘  └─────────────────────────────┘          │
│               │                ▲                              │
│               ▼                │  Vercel AI SDK stream        │
├───────────────┴────────────────┴─────────────────────────────┤
│                    Next.js (Full-stack)                       │
│  API Routes (/api/chat, /api/upload, /api/export, /api/ats)   │
│  Server Actions | Middleware (auth, rate limit)               │
│  ┌──────────────────┐   ┌──────────────────────────────┐     │
│  │  CV Pipeline     │   │  LLM Orchestrator            │     │
│  │  - Parser        │──▶│  - System prompt injection   │     │
│  │  - CRDM Builder  │   │  - Tool calling              │     │
│  │  - Gap Analysis  │   │  - Modular rewrite chain     │     │
│  └──────────────────┘   │  - Zod validation + retry    │     │
│                         └──────────────────────────────┘     │
│                              │                                │
│                              ▼  http://localhost:11434        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                     Ollama (local)                    │    │
│  │  llama3.1:8b / qwen2.5 / llava  + embeddings (nomic)   │    │
│  └──────────────────────────────────────────────────────┘    │
│                              │                                │
│  Persistence: SQLite/Postgres (Drizzle) | FS uploads          │
│  Export workers: LaTeX / DOCX / PDF renderers                │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow (Upload → Optimize → Export)**:
1. User drags PDF/DOCX → `/api/upload` → parser → CRDM (Zod) → stored in conversation context + DB.
2. Optional JD → same, CJDM.
3. Chat message → `/api/chat` (useChat) → orchestrator injects CRDM + history + tools → Ollama.
4. LLM returns (text or tool call) → validated → UI updates + optional side-panel preview refresh.
5. Export request → renderer (LaTeX preferred) → PDF served or downloaded.

---

## 5. User Interface Design

**Overall Aesthetic**: Clean, professional, trustworthy — think Linear + Notion + ChatGPT hybrid. Dark mode default (with light toggle). Generous whitespace, excellent typography (Inter + system fonts).

### Primary Layout (Desktop-first, responsive)
- **Left Sidebar (collapsible, 260px)**:
  - Logo + "VellonCVs"
  - New Chat button
  - Conversation list (searchable, grouped by date)
  - Uploaded Assets section: CV(s) + JDs with "remove / re-parse" actions
  - Model selector (dropdown + "pull new model" modal)
  - Settings (temperature, max tokens, ATS strictness, export format default)
  - Usage / Ollama status indicator (green/red + "ollama serve" hint)

- **Main Area — Split View (flex)**:
  - **Chat Panel (60-70%)**:
    - Messages list (user on right, assistant on left, markdown + code blocks + copy buttons).
    - Special message types:
      - "CV Uploaded" card with parsed summary + "View Structured Data" (JSON tree or nice table).
      - "Optimization Plan" (editable checklist of proposed changes).
      - "Before/After Diff" cards.
      - Tool result cards (ATS Score gauge, keyword coverage heatmap).
    - Composer at bottom: textarea + attach (CV/JD) + voice (optional) + send.
    - Streaming indicator + "Stop generation".
    - Quick actions chips: "Tailor to JD", "Make more quantifiable", "ATS audit", "Shorten to 1 page".

  - **Preview / Analysis Panel (30-40%, resizable)**:
    - Tabs: **Live Preview** (rendered PDF/MD preview — updates on optimization), **Structured View** (CRDM editable fields), **ATS Report** (score + breakdown + missing keywords).
    - "Apply to Preview" / "Commit Version" buttons when chat proposes changes.
    - Export bar: PDF | DOCX | MD | TXT (with version selector).

- **Mobile**: Stacked or bottom-sheet chat; preview collapses to modal.

### Key Interactions & States
- Drag-and-drop anywhere in chat for CV/JD.
- Inline editing of generated bullets (with "regenerate with my edit" feedback loop).
- "Explain why" on any AI suggestion (shows reasoning trace).
- Version timeline in sidebar or under preview.
- Keyboard shortcuts: `/` for commands, `Cmd+K` global search, `Cmd+Enter` send.
- Loading skeletons that feel fast.
- Error states: "Ollama not reachable — run `ollama serve`" with copyable command.

**Accessibility**: WCAG 2.2 AA, keyboard nav, ARIA labels, high contrast, reduced motion support.

**Responsive breakpoints**: 1024px desktop split, below full-width with tab switcher.

**Visual Polish**:
- Smooth message appearance animations.
- Highlighted keyword matches (green for covered, amber for suggested).
- Subtle progress for long pipelines ("Analyzing gaps… Rewriting Experience section…").

---

## 6. LLM Processing Workflow & Prompt Engineering

**Philosophy**: Never do a single giant prompt. Use **deterministic pre/post-processing + atomic validated LLM calls**. This is the key differentiator from naive "paste resume into ChatGPT" tools.

### 6.1 Canonical Data Models (Type-Safe Contracts)
- **CRDM** (`Resume`): `basics`, `work[]`, `education[]`, `skills[]`, `projects[]`, `certifications[]`, plus `metrics`, `rawText`, `sourceHash`, `versions[]`.
- **CJDM** (`JobDescription`): `title`, `company`, `requirements[]` (must-have vs nice-to-have), `keywords` (weighted), `responsibilities`, `seniority`, `domain`.

Use Zod + TypeScript for both.

### 6.2 Ingestion Pipeline
1. **File Upload** → validate size/type.
2. **Text Extraction** (layout-aware preferred):
   - PDF → pdfjs or opendataloader (spatial) → Markdown/JSON segments.
   - Scanned/image PDF → OCR (Tesseract) or VLM (`llava`).
   - DOCX → docx-parser.
3. **LLM-Assisted Structured Extraction** (optional but recommended for accuracy):
   - Use `resume-intel`-style per-section parallel calls:
     - Prompt per section: "Extract ONLY the {basics|work|...} from this text into exact JSON schema. No invention."
   - Self-correction loop (max 3): LLM → Zod.parse → repair prompt with errors → retry.
4. **Normalization & Enrichment**:
   - Standardize dates, emails, phones.
   - Infer implicit skills.
   - Compute initial keyword bag.

Result: Validated CRDM stored in conversation context (and DB).

### 6.3 Optimization Pipeline (Conversational Triggered)
When user says "optimize for this JD" or clicks quick action:

1. **Gap Analysis Engine (GAE)** (mostly deterministic):
   - Keyword coverage (TF-IDF or simple frequency + synonym expansion via embeddings if available).
   - Skill gaps, missing quantification, weak verbs, recency issues.
   - LLM only for nuanced "experience relevance delta" and "suggested accomplishments".

2. **Rewrite Plan Generator (RPG)**:
   - LLM produces structured plan:
     ```json
     {
       "summary": { "action": "expand", "targetKeywords": [...] },
       "work[0].bullets": [ {"id": 3, "action": "quantify", "suggestion": "..."} , ... ],
       ...
     }
     ```
   - Presented to user for approval/edit (critical trust step).

3. **Modular Rewrite Chain (MRC)**:
   - One focused LLM call per item (summary, individual bullet, skills reordering, etc.).
   - System prompt enforces: "Truthful only — never invent facts, dates, titles, or metrics. Use only provided data or user-approved suggestions."
   - Structured output (Zod): `{ newText, keywordsCovered, quantificationAdded, confidence, reasoning }`.
   - Validation + retry on failure.
   - Temperature 0.4, strong instruction to preserve meaning.

4. **ATS Polish Pass** (final):
   - Remove problematic chars, ensure standard headings, enforce 1-page heuristics (or user target), bullet length 1-2 lines.
   - Optional LaTeX compilation test (if using LaTeX path) to catch overflow.

5. **Scoring** (purely algorithmic, no LLM):
   - Structural integrity, keyword density vs JD, content quality (verb strength, metrics), parsability, completeness.
   - Return 0-100 + radar chart data.

### 6.4 Conversational Layer
- Every chat turn receives:
  - Current CRDM (or diff since last).
  - Conversation history (truncated intelligently: keep recent + "CV context summary").
  - Active JD if any.
  - Available tools.
- User can say natural language or use slash commands that map to tool calls.
- "Accept all changes" / "Accept this section only" updates the live CRDM in context.
- Memory of previous rewrites for consistency ("use the same tone as the last version").

### 6.5 Prompt Library (Core Examples)

**System Prompt (always injected server-side)**:
```
You are VellonCVs, an expert career coach and ATS optimization specialist. 
You are truthful, precise, and never fabricate experience. 
You output only valid JSON when asked for structured data. 
Current resume is provided as CRDM JSON. Any changes must be justified and minimal.
```

**Structured Extraction Prompt** (per section):
```
Extract the WORK EXPERIENCE section from the following resume text.
Return ONLY a JSON array matching this Zod schema exactly:
[...]
Resume text:
```

**Gap Analysis + Plan**:
```
Given CRDM and CJDM, produce a RewritePlan JSON...
Focus on truthful alignment. Prioritize high-impact, low-risk edits.
```

**Bullet Rewrite**:
```
Rewrite ONLY this single bullet point. 
Original: "..."
Requirements: incorporate these keywords naturally: [..]
Add quantification if data supports it. 
Return { "newText": "...", "keywordsCovered": [...], "reasoning": "..." }
```

**Safety Guardrails** (in every prompt + post-processing):
- "If information is missing, ask the user or leave placeholder."
- "Never add new companies, titles, dates, or degrees."
- Output validation + user confirmation for any material change.

**Tool Definitions** (for Vercel AI SDK / Ollama tool calling):
- `update_resume_section(section, changes)`
- `compute_ats_score(crdm, optional_jd)`
- `generate_export(format, version_id)`

---

## 7. Implementation Guide (Step-by-Step)

### 7.1 Prerequisites
1. Install **Ollama** (ollama.com) and pull base model:
   ```bash
   ollama serve
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text   # optional for semantic keyword matching
   ```
2. (Optional) LaTeX for beautiful PDFs: `tectonic` (fast, cross-platform) or TeX Live.
3. Node.js 20+ / Bun (preferred for speed).

### 7.2 Project Bootstrap
```bash
npx create-next-app@latest vellon-cvs --yes --tailwind --eslint --app --yes --typescript
cd vellon-cvs
npm install ai @ai-sdk/react ollama-ai-provider zod lucide-react framer-motion sonner
npm install -D @types/pdfjs-dist   # etc for parsers
```

Add scripts for `ollama` health check in dev.

### 7.3 Core Directories
```
app/
  api/
    chat/          # POST → useChat target, streams from Ollama
    upload/        # CV/JD parser entrypoint
    export/        # PDF/DOCX generation
    models/        # list/pull Ollama models
  chat/[id]/       # conversation page
  components/
    chat/          # MessageList, Composer, ToolCards
    cv/            # Preview, StructuredEditor, ATSGauge
    layout/        # Sidebar, ModelSelector
lib/
  ollama.ts        # provider + client config
  parsers/
  pipeline/        # crdm.ts, gap-analysis.ts, rewrite-chain.ts, prompts.ts
  schemas/         # all Zod definitions
  exporters/
db/                # drizzle schema + migrations (or prisma)
```

### 7.4 Key Code Snippets

**Ollama Provider Setup** (`lib/ollama.ts`):
```ts
import { createOllama } from 'ollama-ai-provider';
export const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});
export const DEFAULT_MODEL = 'llama3.1:8b';
```

**Chat API Route** (`app/api/chat/route.ts`):
```ts
import { streamText, tool } from 'ai';
import { ollama, DEFAULT_MODEL } from '@/lib/ollama';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages, model = DEFAULT_MODEL, crdm, activeJD } = await req.json();

  const result = await streamText({
    model: ollama(model),
    system: buildSystemPrompt(crdm, activeJD),
    messages,
    tools: {
      rewriteSection: tool({ /* params + execute that calls pipeline */ }),
      // more tools
    },
    maxTokens: 2048,
    temperature: 0.4,
  });

  return result.toDataStreamResponse();
}
```

**useChat on Client**:
```tsx
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  body: { model, crdm: currentCRDM, activeJD },
  onToolCall: handlePipelineTool,
});
```

**Parser Entry** (`lib/parsers/index.ts`):
- Detect extension → dispatch to pdfjs / docx-parser.
- Fallback to VLM if text extraction confidence low.

**Pipeline Orchestrator**:
- Pure functions: `analyzeGaps(crdm, cjdm) → GapReport`
- `generateRewritePlan(...) → Plan`
- `executeModularRewrites(crdm, plan) → Promise<UpdatedCRDM>`
- Each step emits progress events for UI.

**Export**:
- For LaTeX: render template with data using Handlebars or EJS → compile with child_process `tectonic`.
- Serve file from `/api/export?id=xxx&format=pdf`.

### 7.5 Database (Drizzle example)
Tables: `users`, `conversations`, `messages`, `resumes` (JSONB for CRDM + file metadata), `exports`.

### 7.6 Running
```bash
npm run dev          # Next.js on 3000
# In another terminal: ollama serve
```
Visit http://localhost:3000 → upload CV → start chatting.

### 7.7 Production Hardening
- Docker Compose with healthchecks for Ollama + app.
- Nginx reverse proxy with WebSocket support and long timeouts (`proxy_read_timeout 300s`).
- Model pre-warming + queue (BullMQ) if >5 concurrent users.
- PII redaction before any LLM call (optional regex + LLM pass).
- Content Security Policy, strict CORS.

---

## 8. Security, Privacy & Compliance

- **Data never leaves device** unless user explicitly enables hybrid cloud fallback.
- All prompts include "Do not invent facts" + strict output schemas.
- User confirmation gate before material rewrites.
- File hashing + versioning to detect tampering.
- Optional on-prem deployment only (no telemetry).
- GDPR / CCPA friendly: full data export + delete per conversation.
- Prompt injection defense: treat CV text as untrusted; use XML-style or special delimiters + instruction hierarchy.

---

## 9. Roadmap & Future Enhancements

**Phase 2 (post-MVP)**
- Job board integration (paste JD URL → auto-fetch & parse).
- RAG over user's historical optimized CVs + company research docs.
- Multi-agent architecture (Strategist + Editor + ATS Auditor agents) with shared memory.
- Cover letter generator + interview prep chat (same context).
- Batch optimization for multiple target roles.
- Desktop app (Tauri) with embedded Ollama management.
- Fine-tuned LoRA adapters for domain-specific CV styles (tech, academia, creative).

**Evaluation Harness**
- Golden dataset of 50 real (anonymized) resumes + JDs.
- Automated metrics: keyword recall, ATS parse success rate, human preference A/B.
- Hallucination detection via factuality checks against source CRDM.

---

## 10. References & Resources

- Vercel AI SDK + Ollama guides (2026)
- calibrcv-cli, LLMResumeBuilder, AutoATS, TailorCV, agentic-cv-builder, resume-intel (inspiration for pipelines)
- JSON Resume schema
- Modern document parsers: opendataloader-pdf, docx-parser, kreuzberg
- Ollama + Open WebUI production stacks
- LaTeX resume templates (sb2nov, moderncv)

---

**Next Steps for Implementation**
1. Bootstrap Next.js project as above.
2. Implement file upload + basic parser (PDF text first).
3. Wire Vercel AI SDK chat with simple "echo + CRDM in context".
4. Add CRDM Zod schema + one modular rewrite tool.
5. Layer on gap analysis, plan approval UI, LaTeX export.
6. Polish UI, add ATS scoring, versioning.
7. Dockerize + documentation.

This blueprint provides a complete, battle-tested foundation. Following the multi-stage validated pipeline + conversational UX will result in a tool users trust with their careers.

**VellonCVs** — Professional CVs, powered by your hardware, controlled by conversation.
