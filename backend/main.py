import os
import asyncio
import logging
from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from database import init_db, create_mission, update_mission_result
from core.agents import create_agents, create_tasks, MANAGER_MODEL, GEMINI_SAFETY_SETTINGS
from core.socket_handler import WebSocketHandler
from core.logging_handler import WebSocketLoggingHandler
from core.stdout_capture import StdoutInterceptor
from core.execution import run_mission_loop
from api.routes import router as api_router
from tools.base_tools import human_input_store

# CrewAI
from crewai import Crew, Process, LLM

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
async def websocket_handler(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("action") == "START_MISSION":
                payload = data["payload"]
                mission_id = create_mission(payload['plan'][0]['instruction'][:50])
                
                # Setup Env
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing API Key"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key
                # CrewAI workaround: some internal tools check for OPENAI_API_KEY.
                # Setting it to "NA" prevents validation errors when using other providers.
                if "OPENAI_API_KEY" not in os.environ:
                    os.environ["OPENAI_API_KEY"] = "NA"
                
                # Setup Logging Handler for WebSocket
                loop = asyncio.get_running_loop()
                log_handler = WebSocketLoggingHandler(websocket, loop)
                # Capture everything from root logger down
                root_logger = logging.getLogger()
                root_logger.addHandler(log_handler)
                # Ensure level is INFO or DEBUG
                root_logger.setLevel(logging.INFO)

                # Initialize Stdout Interceptor for Raw Terminal Output
                stdout_interceptor = StdoutInterceptor(websocket, loop)
                stdout_interceptor.start()

                try:
                    # Create Agents (Plan is handled in execution loop)
                    uploaded_files = payload.get("files", [])
                    agents_map = create_agents(payload['agents'], uploaded_files, websocket, mission_id)

                    # Execute Custom Mission Loop
                    await run_mission_loop(
                        payload['plan'],
                        agents_map,
                        websocket,
                        mission_id
                    )

                    update_mission_result(mission_id, "Mission Complete", status="COMPLETED")
                    await websocket.send_json({"type": "SYSTEM", "content": "Mission Execution Finished."})

                except Exception as e:
                    update_mission_result(mission_id, str(e), status="FAILED")
                    await websocket.send_json({"type": "ERROR", "content": f"Error: {str(e)}"})
                finally:
                    # Remove the handler to avoid duplicates or leaks
                    root_logger.removeHandler(log_handler)
                    stdout_interceptor.stop()

            elif data.get("action") == "HUMAN_RESPONSE":
                human_input_store[data["requestId"]] = data["content"]
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WS Error: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)

@app.websocket("/")
async def websocket_endpoint_root(websocket: WebSocket):
    await websocket_handler(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
