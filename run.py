import os, uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.backend.db import init_db
from app.backend.routers.vm import router as vm_router
from app.backend.routers.crud import router as crud_router

app = FastAPI(title="Plantit", docs_url="/docs", redoc_url=None)

# Serve static assets
STATIC_DIR = os.path.join(os.path.dirname(__file__), "app", "frontend", "static")
INDEX_FILE = os.path.join(os.path.dirname(__file__), "app", "frontend", "index.html")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Same-origin serving; CORS not needed, but keep minimal if future split occurs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # same origin default, tighten if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def index():
    return FileResponse(INDEX_FILE)

@app.get("/health")
async def health():
    return JSONResponse({"status":"ok"})

# Routers
app.include_router(vm_router, prefix="/api/vm", tags=["vm"])
app.include_router(crud_router, prefix="/api", tags=["api"])

if __name__ == "__main__":
    init_db()  # create tables & seed if empty
    host = os.environ.get("APP_HOST", "127.0.0.1")
    port = int(os.environ.get("APP_PORT", "7600"))
    uvicorn.run("run:app", host=host, port=port, reload=False)
