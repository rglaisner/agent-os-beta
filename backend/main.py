import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from core.database import init_db
from core.config import validate_environment
from api.routes import router as api_router
from api.websocket import websocket_handler
from api.analytics import router as analytics_router
from api.suggestions import router as suggestions_router
from api.scheduling import router as scheduling_router
from api.custom_tools import router as custom_tools_router
from api.communications import router as communications_router
from api.export import router as export_router

app = FastAPI()

# Validate environment variables
if not validate_environment():
    print("Server startup aborted due to missing environment variables.")
    exit(1)

# Initialize DB & Uploads
init_db()
os.makedirs("uploads", exist_ok=True)
os.makedirs("static/plots", exist_ok=True) # Ensure plot directory exists

# CORS Configuration - more secure defaults
# Allow specific origins in production, use environment variable for flexibility
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
if "*" in allowed_origins and os.getenv("ENVIRONMENT") == "production":
    print("WARNING: CORS is set to allow all origins in production. Consider restricting this.")
    allowed_origins = ["*"]  # Keep wildcard only if explicitly set

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount Static Files (Uploads & Plots)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include API Routes
app.include_router(api_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(suggestions_router, prefix="/api")
app.include_router(scheduling_router, prefix="/api")
app.include_router(custom_tools_router, prefix="/api")
app.include_router(communications_router, prefix="/api")
app.include_router(export_router, prefix="/api")

# Health check endpoint for Render.com
@app.get("/health")
async def health_check():
    return {"status": "ok", "port": os.getenv("PORT", "unknown")}

# --- WEBSOCKET ENDPOINT ---
# Support both /ws and / for WebSocket connections
# This ensures compatibility with different frontend configurations
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)

if __name__ == "__main__":
    import uvicorn
    # Use PORT environment variable (set by Render) or default to 8000 for local development
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        ws="auto"  # Explicit WebSocket support
    )
