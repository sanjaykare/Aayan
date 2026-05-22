"""
Hospital Migration Validator — FastAPI Application
Provides endpoints for uploading CSV files and running validation agents.
"""

import os
import platform
from collections import namedtuple

# Prevent platform-related hangs in sandboxed/restricted Windows environments
platform.machine = lambda: "AMD64"
_UnameResult = namedtuple("uname_result", ["system", "node", "release", "version", "machine", "processor"])
platform.uname = lambda: _UnameResult("Windows", "localhost", "10", "10.0.0", "AMD64", "AMD64")

# Suppress OpenBLAS memory-allocation warnings on low-RAM Windows machines
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from core.loader import load_csv
from core.validator import run_validation


# ── App setup ───────────────────────────────────────────────
app = FastAPI(
    title="Hospital Migration Validator",
    description="AI Agent-powered hospital data migration validation for KareXpert",
    version="1.0.0",
)

# CORS — allow all origins for demo purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Templates
# NOTE: Jinja2's LRU cache is broken on Python 3.14 (tuple unhashable as dict key).
# Workaround: disable the cache by setting cache_size=0.
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
from jinja2 import Environment, FileSystemLoader
_jinja_env = Environment(
    loader=FileSystemLoader(templates_dir),
    auto_reload=True,
    cache_size=0,
)
templates = Jinja2Templates(env=_jinja_env)


# ── Routes ──────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main upload and validation UI."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.post("/validate")
async def validate(file: UploadFile = File(...)):
    """
    Accept a CSV upload, run all validation agents,
    and return the full migration report as JSON.
    """
    # Read file contents
    contents = await file.read()

    try:
        df = load_csv(contents)
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to parse CSV: {str(e)}"},
        )

    # Run the validation pipeline
    report = run_validation(df)

    return JSONResponse(content=report)


@app.get("/sample")
async def download_sample():
    """Serve the sample patients.csv for download."""
    csv_path = os.path.join(os.path.dirname(__file__), "patients.csv")
    if not os.path.exists(csv_path):
        return JSONResponse(status_code=404, content={"error": "Sample file not found"})
    return FileResponse(
        csv_path,
        media_type="text/csv",
        filename="patients.csv",
    )


# ── Run with uvicorn ────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
