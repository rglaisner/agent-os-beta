import os
import asyncio
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Imports
from database import init_db, create_mission, update_mission_result
from core.agents import create_agents, create_tasks
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
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
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
                os.environ["OPENAI_API_KEY"] = "NA" # CrewAI fix
                
                try:
                    # Create Agents & Tasks
                    uploaded_files = payload.get("files", [])
                    agents_map = create_agents(payload['agents'], uploaded_files, websocket, mission_id)
                    tasks = create_tasks(payload['plan'], agents_map, uploaded_files)

                    # Process Type logic
                    process_type = payload.get("processType", "sequential")

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
                        crew_args["manager_llm"] = LLM(model="gemini/gemini-1.5-pro", temperature=0.7)

                    crew = Crew(**crew_args)

                    result = await asyncio.get_event_loop().run_in_executor(None, crew.kickoff)
                    update_mission_result(mission_id, str(result))
                    await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})

                except Exception as e:
                    update_mission_result(mission_id, str(e), status="FAILED")
                    await websocket.send_json({"type": "ERROR", "content": f"Error: {str(e)}"})

            elif data.get("action") == "HUMAN_RESPONSE":
                human_input_store[data["requestId"]] = data["content"]
    except Exception as e:
        print(f"WS Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
