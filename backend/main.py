import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from core.database import init_db
from api.routes import router as api_router
from api.websocket import websocket_handler

app = FastAPI()

# Initialize DB & Uploads
init_db()
os.makedirs("uploads", exist_ok=True)
os.makedirs("static/plots", exist_ok=True) # Ensure plot directory exists

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
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
