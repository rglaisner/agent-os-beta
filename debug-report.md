## Agent OS – Debug & Deployment Report

### 1. Scope

- Backend: FastAPI + CrewAI + Gemini (via `langchain-google-genai`) + SQLite + ChromaDB.
- Frontend: React + Vite + Tailwind, deployed on Vercel.
- Environments: local dev, Render (backend), Vercel (frontend).

---

### 2. Backend findings & fixes

- **CrewAI tools / `BaseTool` import broke tests and runtime**
  - Problem: Newer `crewai_tools` and `crewai` versions no longer expose `BaseTool` in the same way, causing `ImportError: cannot import name 'BaseTool'` during test collection.
  - Fix:
    - Implemented **version‑agnostic imports** in `core/agents.py` and `tools/rag.py`:
      - Try to import `BaseTool` from the official module.
      - On failure, define a small `Protocol` that mimics the needed interface, and import all concrete tools without `BaseTool`.
  - Benefit: Backend becomes resilient to `crewai` / `crewai_tools` minor version changes without sacrificing type clarity.

- **Agent/task creation assumed Pydantic models only**
  - Problem: `create_agents` and `create_tasks` only worked with `AgentModel` / `PlanStep` instances. Tests (and any legacy callers) passing plain dicts caused `AttributeError` (e.g. `'dict' object has no attribute 'toolIds'`).
  - Fix:
    - Added an internal `_get()` helper to safely read attributes or dict keys.
    - Both functions now support:
      - Pydantic models (production path).
      - Plain dicts (tests, legacy code).
  - Result: **All backend tests now pass** (`pytest` in `backend/`), and the runtime is more robust to slight schema shape differences.

- **Environment & deployment readiness**
  - Problem: `uvicorn.run` used a hard‑coded port `8000`, which does not work on Render (expects `PORT`).
  - Fix:
    - Updated `backend/main.py` to respect `PORT` with a safe default:
      - `port = int(os.getenv("PORT", "8000"))`
      - `uvicorn.run(app, host="0.0.0.0", port=port)`
  - Other notes:
    - Startup validates `GEMINI_API_KEY` via `validate_environment()`; this is the **single required env var** for LLM operations.
    - `GEMINI_API_KEY` is used consistently across:
      - `/api/plan` (`ChatGoogleGenerativeAI`).
      - WebSocket missions (`GOOGLE_API_KEY` is set from `GEMINI_API_KEY` for CrewAI tools).
      - RAG embeddings (`tools/rag.py` prefers `GEMINI_API_KEY` per Gemini API docs [`https://ai.google.dev/gemini-api/docs.md.txt`](https://ai.google.dev/gemini-api/docs.md.txt)).

- **Data & file paths**
  - The backend creates and uses:
    - `agent_os.db` (SQLite) – local‑first persistence for missions.
    - `uploads/` – user file uploads.
    - `static/plots/` – plot images from data‑viz tool.
    - `chroma_db/` – ChromaDB persistent store for Knowledge Base.
  - On Render, these will live on the service’s filesystem; for the free tier this is acceptable but **not durable across redeploys**. For stronger guarantees, a managed DB or external storage should back these in the future.

---

### 3. Frontend findings & fixes

- **Unit tests (Vitest) were not wired**
  - Problem: `npm test` was missing; Vitest config was absent; the only test file (`src/tests/storage.test.ts`) was not being run.
  - Fix:
    - Added `vitest` as a devDependency.
    - Configured Vite test runner in `vite.config.ts`:
      - `test.globals = true`
      - `test.environment = 'node'` (sufficient as tests mock `localStorage` themselves).
      - `include: ['src/**/*.test.{ts,tsx}']` to scope to true unit tests.
    - Wired `"test": "vitest"` in `package.json`.
  - Result: `npm test` runs the storage tests and they all **pass**.

- **E2E tests (Playwright) and tooling conflict**
  - There is an existing Playwright spec (`tests/happy_path.spec.ts`) designed to exercise the full app (Knowledge → Setup → Plan → Launch → Monitor).
  - Running `npx playwright test` currently triggers an upstream **matcher conflict** (`TypeError: Cannot redefine property: Symbol($$jest-matchers-object)`), caused by a clash between `@vitest/expect` and Playwright’s own expect implementation.
  - Current status:
    - Unit tests are green and do not depend on Playwright.
    - E2E tests are present and logically valid but blocked by this tooling issue; resolving it cleanly would require version pinning or isolating Playwright from Vitest’s global expect.
  - Recommended next step (optional):
    - Keep E2E in a **separate test runner context** (e.g. a dedicated npm script and, if needed, a minor dependency realignment).

- **Runtime behavior & configuration**
  - The frontend connects to the backend WebSocket using:
    - `const backendUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';`
  - This is already deployment‑friendly:
    - Local dev: no env var needed; use default `ws://localhost:8000/ws`.
    - Vercel: set `VITE_BACKEND_URL` to your Render backend’s WebSocket URL (e.g. `wss://<render-service>.onrender.com/ws`).

---

### 4. Optimizations & structural notes

- **Resilience to upstream library changes**
  - By adding compatibility shims for `BaseTool` and allowing dict/Pydantic inputs in agent/task creation, the backend is less brittle to:
    - `crewai` and `crewai_tools` minor releases.
    - Small schema changes in the plan/agent payload from the frontend (or CrewAI plan generator).

- **Separation of concerns**
  - Mission execution pipeline:
    - `/api/plan` handles **planning only**, with Gemini.
    - The WebSocket `/ws` handles **execution**, using CrewAI `Crew` with:
      - `create_agents(...)` and `create_tasks(...)`.
      - Optional hierarchical manager (`MANAGER_MODEL`) when `processType` is hierarchical.
  - Knowledge Base:
    - Encapsulated in `tools/rag.py` and exposed through:
      - REST `/api/knowledge*` routes for frontend UX.
      - CrewAI `KnowledgeBaseTool` for agent missions.

- **Local‑first, cloud‑ready**
  - All stateful components (SQLite, Chroma, uploads, plots) use **relative paths** and are created on startup.
  - This keeps the experience local‑first while allowing the same code to run on Render (with the caveat about non‑durable filesystem on free tier).

---

### 5. Deployment guide (Render + Vercel)

#### Backend – Render (existing service)

Assuming you already have a Render web service pointing at this repo:

1. **Environment variables**
   - Required:
     - `GEMINI_API_KEY` – your Gemini API key from Google AI Studio.
   - Recommended:
     - `CORS_ORIGINS` – comma‑separated list including:
       - `https://agent-os-beta.vercel.app`
       - `https://agent-os-beta-remy-gs-projects.vercel.app`
       - Any preview domains you care about (or `*` for permissive dev use).
     - `ENVIRONMENT=production` – so CORS warnings and production branches behave as expected.

2. **Service settings**
   - Build command: install deps and (optionally) run tests, e.g.:
     - `pip install -r backend/requirements.txt`
   - Start command (web service):
     - Option A (simple): `cd backend && python main.py`
     - Option B (explicit uvicorn): `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Ensure the service type is a **Web Service**, not a background worker.

3. **Ports & health**
   - Render will inject `PORT`; `backend/main.py` now respects it.
   - Default path: `https://<your-render-service>.onrender.com/`
     - WebSocket endpoint: `wss://<your-render-service>.onrender.com/ws`
     - REST API base: `https://<your-render-service>.onrender.com/api/...`

#### Frontend – Vercel (`agent-os-beta`)

Your Vercel project `agent-os-beta` is already set up. To align it with the new backend:

1. **Environment variables (Vercel project → Settings → Environment Variables)**
   - Add/update:
     - `VITE_BACKEND_URL = wss://<your-render-service>.onrender.com/ws`
   - Apply to:
     - Production (and Preview/Development if you want).
   - Redeploy to propagate changes.

2. **Build & framework**
   - Framework: `Vite` (already configured).
   - Build command: `npm run build`
   - Install command: `npm install`
   - Output directory: `dist`

3. **Manual verification**
   - Visit `https://agent-os-beta.vercel.app`:
     - Verify:
       - Knowledge Base upload works (`/api/knowledge` on Render).
       - Plan generation via `/api/plan` succeeds (Gemini key set).
       - Mission launch connects via WebSocket and streams logs in Monitor.

---

### 6. Summary of what’s now working

- Backend:
  - Starts locally with `GEMINI_API_KEY` set.
  - Is Render‑ready via `PORT` and environment‑driven CORS.
  - All backend tests (`pytest` in `backend/`) pass.

- Frontend:
  - Local dev via `npm run dev` using `ws://localhost:8000/ws` by default.
  - Unit tests green via `npm test` (Vitest).
  - Deployment‑ready for Vercel with `VITE_BACKEND_URL` targeting Render.

This file is a living document; future structural or performance changes can be appended in new sections, keeping a clear audit trail of debugging and optimization decisions.

