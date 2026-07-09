"""
OliveBot Server — FastAPI
Serves static files, proxies OpenAI API, and exposes DKT endpoints.
Backward-compatible with the original stdlib server.py.
"""
import os, json, ssl, httpx, asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ── Load .env ────────────────────────────────────────────────────────────────

def load_env():
    if os.path.exists('.env'):
        with open('.env') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip().strip("'\"")

load_env()
API_KEY = os.environ.get('OPENAI_API_KEY')
PORT = int(os.environ.get('PORT', 8080))

# ── DKT State ────────────────────────────────────────────────────────────────

_dkt_user_id: Optional[str] = None  # Currently loaded user
_dkt_initialized = False
_scheduler = None

def _init_dkt_scheduler():
    """Initialize background scheduler for periodic mastery refresh."""
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        _scheduler = AsyncIOScheduler()
        _scheduler.add_job(_run_mastery_refresh, 'interval', hours=6, id='dkt_cron')
        _scheduler.start()
        print("[DKT] Background scheduler started (every 6h)")
    except ImportError:
        print("[DKT] APScheduler not installed — cron disabled")
    except Exception as e:
        print(f"[DKT] Scheduler init failed: {e}")

async def _run_mastery_refresh():
    """Cron job: refresh mastery for all users."""
    try:
        from dkt.integration_service import refresh_all_mastery
        refresh_all_mastery()
    except Exception as e:
        print(f"[DKT Cron] Error: {e}")

# ── App Lifecycle ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_dkt_scheduler()
    yield
    if _scheduler: _scheduler.shutdown(wait=False)

app = FastAPI(title="OliveBot", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── OpenAI Chat Proxy ────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat_proxy(request: Request):
    if not API_KEY:
        raise HTTPException(500, detail="API Key not configured on the server.")
    body = await request.body()
    async with httpx.AsyncClient(verify=False, timeout=60) as client:
        try:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                content=body,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
            )
            return JSONResponse(content=resp.json(), status_code=resp.status_code)
        except Exception as e:
            raise HTTPException(500, detail=str(e))

# ── DKT Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/upload_user_data")
async def upload_user_data(request: Request):
    """Accept User Info JSON, run ETL, and store state."""
    global _dkt_user_id, _dkt_initialized
    try:
        data = await request.json()
        user_id = str(data.get("userid", data.get("username", "unknown")))

        # Run ETL for this single user
        from dkt.concept_taxonomy import build_taxonomy, save_taxonomy, TAXONOMY_FILE
        from dkt.etl_pipeline import derive_interactions, compute_time_deltas, extract_user_states
        import pandas as pd

        input_dir = os.path.join(os.path.dirname(__file__), "example_io")

        # Build/load taxonomy
        if os.path.exists(TAXONOMY_FILE):
            from dkt.concept_taxonomy import load_taxonomy
            taxonomy = load_taxonomy()
        else:
            taxonomy = build_taxonomy(input_dir)
            save_taxonomy(taxonomy)

        # Derive interactions for uploaded user
        df = derive_interactions(data, taxonomy)
        if not df.empty:
            df = compute_time_deltas(df)
            states = extract_user_states(df, taxonomy)

            # Merge with existing states
            states_path = os.path.join(os.path.dirname(__file__), "dkt", "data", "user_states.json")
            existing = {}
            if os.path.exists(states_path):
                with open(states_path) as f: existing = json.load(f)
            existing.update(states)
            os.makedirs(os.path.dirname(states_path), exist_ok=True)
            with open(states_path, "w") as f: json.dump(existing, f, indent=2, default=str)

        _dkt_user_id = user_id
        _dkt_initialized = True
        return {"status": "ok", "user_id": user_id, "interactions": len(df)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

def _get_or_load_uid(user_id: Optional[str] = None) -> Optional[str]:
    global _dkt_user_id
    if user_id:
        return user_id
    if _dkt_user_id:
        return _dkt_user_id
    states_path = os.path.join(os.path.dirname(__file__), "dkt", "data", "user_states.json")
    if os.path.exists(states_path):
        with open(states_path) as f:
            states = json.load(f)
            if states:
                _dkt_user_id = list(states.keys())[0]
                return _dkt_user_id
    return None

@app.get("/api/user/mastery_status")
async def mastery_status(user_id: Optional[str] = None):
    """Return current concept mastery probabilities."""
    uid = _get_or_load_uid(user_id)
    if not uid: raise HTTPException(400, "No user loaded. Upload data first.")
    try:
        from dkt.inference import get_all_mastery_status
        return {"user_id": uid, "concepts": get_all_mastery_status(uid)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/user/flagged_concepts")
async def flagged_concepts(user_id: Optional[str] = None, threshold: float = 0.75):
    """Return concepts below retention threshold."""
    uid = _get_or_load_uid(user_id)
    if not uid: raise HTTPException(400, "No user loaded.")
    try:
        from dkt.inference import get_flagged_concepts
        return {"user_id": uid, "threshold": threshold, "flagged": get_flagged_concepts(uid, threshold)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/user/generate_booster")
async def generate_booster(request: Request):
    """Generate booster quiz from flagged concepts."""
    body = await request.json()
    uid = _get_or_load_uid(body.get("user_id"))
    count = body.get("question_count", 10)
    if not uid: raise HTTPException(400, "No user loaded.")
    try:
        from dkt.integration_service import generate_booster_quiz
        return generate_booster_quiz(uid, count)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/user/update_after_quiz")
async def update_after_quiz(request: Request):
    """Update model state after booster quiz completion."""
    body = await request.json()
    uid = _get_or_load_uid(body.get("user_id"))
    if not uid: raise HTTPException(400, "No user loaded.")
    
    # Process the delta log update
    try:
        from dkt.integration_service import process_quiz_results
        process_quiz_results(uid, body)
    except Exception as e:
        print(f"[DKT] Failed to process quiz results: {e}")

    # Re-compute mastery with updated interactions
    try:
        from dkt.inference import get_all_mastery_status
        return {"user_id": uid, "updated": True, "concepts": get_all_mastery_status(uid)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/dkt/health")
async def dkt_health():
    """DKT model health check."""
    from dkt.inference import _get_predictor
    predictor = _get_predictor()
    return {
        "model_loaded": predictor.is_available if predictor else False,
        "user_loaded": _dkt_user_id,
        "scheduler_running": _scheduler is not None and _scheduler.running if _scheduler else False,
    }

# ── Dynamic Data Endpoint ────────────────────────────────────────────────────

@app.get("/api/data")
async def get_data():
    """Serve the latest mock_test_data.json for dynamic fetching."""
    data_path = os.path.join(os.path.dirname(__file__), "mock_test_data.json")
    if os.path.exists(data_path):
        return FileResponse(data_path)
    return JSONResponse({"error": "Data not found"}, status_code=404)

# ── Static Files (must be LAST — catch-all) ──────────────────────────────────

@app.get("/")
async def serve_index():
    return FileResponse("index.html")

# Serve specific directories first
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/public", StaticFiles(directory="public"), name="public")
app.mount("/data", StaticFiles(directory="data"), name="data")

# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print(f"Serving on port {PORT} at http://localhost:{PORT}")
    print(f"  → DKT endpoints enabled")
    print(f"  → OpenAI proxy at /api/chat")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
