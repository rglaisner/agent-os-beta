import os
import asyncio
import logging
from fastapi import WebSocket, WebSocketDisconnect

# Imports
from core.database import create_mission, update_mission_result
from core.agents import create_agents, create_tasks
from core.config import MANAGER_MODEL, GEMINI_SAFETY_SETTINGS
from core.socket_handler import WebSocketHandler
from core.logging_handler import WebSocketLoggingHandler
from tools.base_tools import human_input_store

# CrewAI
from crewai import Crew, Process, LLM

async def websocket_handler(websocket: WebSocket):
    """
    Handle WebSocket connections for mission execution.
    Includes input validation and robust error handling.
    """
    # Accept WebSocket connection
    # FastAPI WebSocket doesn't use CORS middleware, so we accept all origins
    # In production, you can add origin validation here if needed
    try:
        await websocket.accept()
    except Exception as e:
        # Log but don't raise - connection might already be closed
        print(f"WebSocket accept error (may be expected): {e}")
        return
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except ValueError as e:
                # JSON parsing error
                await websocket.send_json({"type": "ERROR", "content": f"Invalid JSON format: {str(e)}"})
                continue
            except Exception as e:
                # Other receive errors (connection closed, etc.)
                await websocket.send_json({"type": "ERROR", "content": f"Error receiving message: {str(e)}"})
                continue

            if data.get("action") == "START_MISSION":
                payload = data.get("payload")

                # Input Validation
                if not payload:
                     await websocket.send_json({"type": "ERROR", "content": "Missing payload."})
                     continue

                if not isinstance(payload.get("plan"), list) or not payload["plan"]:
                     await websocket.send_json({"type": "ERROR", "content": "Invalid or missing 'plan' in payload."})
                     continue

                if not isinstance(payload.get("agents"), list) or not payload["agents"]:
                     await websocket.send_json({"type": "ERROR", "content": "Invalid or missing 'agents' in payload."})
                     continue

                try:
                    # Extract goal from plan or use default
                    goal_text = payload.get('goal', '')
                    if not goal_text and payload.get('plan') and len(payload['plan']) > 0:
                        goal_text = payload['plan'][0].get('instruction', 'Mission')[:100]
                    if not goal_text:
                        goal_text = 'Mission'
                    mission_id = create_mission(goal_text)
                    # Send mission ID to frontend
                    await websocket.send_json({"type": "MISSION_STARTED", "mission_id": mission_id, "goal": goal_text})
                except Exception as e:
                    await websocket.send_json({"type": "ERROR", "content": f"Database Error: {str(e)}"})
                    continue

                # Setup Env
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing API Key"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key

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
                    # Define Embedder Config (ensuring defaults to Google)
                    embedder_config = {
                        "provider": "google-generativeai",
                        "config": {
                            "model": "models/embedding-001",
                            "api_key": api_key
                        }
                    }

                    crew_args = {
                        "agents": list(agents_map.values()),
                        "tasks": tasks,
                        "process": Process.hierarchical if process_type == "hierarchical" else Process.sequential,
                        "verbose": True,
                        "embedder": embedder_config
                    }

                    if process_type == "hierarchical":
                        # Manager LLM - explicit model name
                        manager_handler = WebSocketHandler(websocket, mission_id, default_model=MANAGER_MODEL.split("/")[-1])
                        crew_args["manager_llm"] = LLM(
                            model=MANAGER_MODEL,
                            temperature=0.7,
                            callbacks=[manager_handler],
                            timeout=600,  # 10 minutes timeout
                            safety_settings=GEMINI_SAFETY_SETTINGS
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

                    try:
                        update_mission_result(mission_id, str(result))
                    except Exception as db_err:
                        # Log but don't fail the mission output to user if just DB update fails
                        print(f"Failed to update mission result: {db_err}")

                    await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})

                except Exception as e:
                    try:
                        update_mission_result(mission_id, str(e), status="FAILED")
                    except Exception:
                        pass # Ignore DB error on failure update
                    await websocket.send_json({"type": "ERROR", "content": f"Error: {str(e)}"})
                finally:
                    # Remove the handler to avoid duplicates or leaks
                    root_logger.removeHandler(log_handler)

            elif data.get("action") == "HUMAN_RESPONSE":
                if "requestId" in data and "content" in data:
                    human_input_store[data["requestId"]] = data["content"]
                else:
                    await websocket.send_json({"type": "ERROR", "content": "Invalid HUMAN_RESPONSE payload."})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WS Error: {e}")
