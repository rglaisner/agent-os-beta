import os
import asyncio
import logging
from fastapi import FastAPI, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from database import init_db, create_mission, update_mission_result
from core.agents import create_agents, create_tasks, MANAGER_MODEL
from core.socket_handler import WebSocketHandler
from core.logging_handler import WebSocketLoggingHandler
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

                try:
                    # Create Agents & Tasks
                    uploaded_files = payload.get("files", [])
                    # Support 'context' from App_Local as file content if passed
                    if payload.get("context"):
                        # If context is raw text, maybe save it to a file?
                        # For now, we assume payload['files'] handles file paths.
                        pass

                    agents_map = create_agents(payload['agents'], uploaded_files, websocket, mission_id)
                    tasks = create_tasks(payload['plan'], agents_map, uploaded_files)

                    # Process Type logic
                    process_type = payload.get("processType") or payload.get("process") or "sequential"

                    await websocket.send_json({"type": "SYSTEM", "content": f"Mission Started ({process_type.upper()})"})

                    # Crew Configuration
                    crew_args = {
                        "agents": list(agents_map.values()),
                        "tasks": tasks,
                        "process": Process.hierarchical if process_type == "hierarchical" else Process.sequential,
                        "verbose": True
                    }

                    if process_type == "hierarchical":
                        # Manager LLM - explicit model name
                        manager_handler = WebSocketHandler(websocket, mission_id, default_model=MANAGER_MODEL.split("/")[-1])
                        crew_args["manager_llm"] = LLM(
                            model=MANAGER_MODEL,
                            temperature=0.7,
                            callbacks=[manager_handler]
                        )

                    crew = Crew(**crew_args)

                    # Training Phase
                    train_iterations = 0
                    if 'plan' in payload:
                        for step in payload['plan']:
                            if step.get('trainingIterations'):
                                train_iterations = max(train_iterations, int(step['trainingIterations']))

                    if train_iterations > 0:
                        await websocket.send_json({"type": "SYSTEM", "content": f"Initiating Training Phase ({train_iterations} iterations)..."})
                        # Create a unique filename for training data
                        train_file = f"uploads/training_mission_{mission_id}.pkl"
                        await asyncio.get_event_loop().run_in_executor(None, lambda: crew.train(n_iterations=train_iterations, filename=train_file))
                        await websocket.send_json({"type": "SYSTEM", "content": "Training Complete. Starting Mission..."})

                    result = await asyncio.get_event_loop().run_in_executor(None, crew.kickoff)
                    update_mission_result(mission_id, str(result))
                    await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})

                except Exception as e:
                    update_mission_result(mission_id, str(e), status="FAILED")
                    await websocket.send_json({"type": "ERROR", "content": f"Error: {str(e)}"})
                finally:
                    # Remove the handler to avoid duplicates or leaks
                    root_logger.removeHandler(log_handler)

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
