import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from core.database import init_db
from core.config import validate_environment
from api.routes import router as api_router
from api.websocket import websocket_handler

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

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)

@app.websocket("/")
async def websocket_endpoint_root(websocket: WebSocket):
    await websocket_handler(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
