import json
import os
import asyncio
import time
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import yfinance as yf

# --- IMPORTS FOR DATABASE ---
# We import the database functions we created in Phase 1
from database import init_db, create_mission, add_event, update_mission_result, SessionLocal, Mission, MissionEvent

# --- IMPORTS FOR AI ---
from crewai import Agent, Task, Crew, Process, LLM
from langchain_core.callbacks import BaseCallbackHandler
from crewai.tools import BaseTool
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool, YoutubeChannelSearchTool

# --- NEW IMPORT: PYTHON EXECUTION ---
# This library allows the AI to run Python code
from langchain_experimental.tools import PythonREPLTool

app = FastAPI()

# 1. START DATABASE
# This creates the 'agent_os.db' file if it doesn't exist
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE DEPENDENCY ---
# This helper function gives us a connection to the database
# and closes it automatically when we are done.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- CUSTOM TOOLS ---

# 1. Custom Finance Tool (Built by us to avoid import errors)
class CustomYahooFinanceTool(BaseTool):
    name: str = "Yahoo Finance Tool"
    description: str = "Get current stock price and info. Input must be a ticker symbol (e.g. 'AAPL')."

    def _run(self, ticker: str) -> str:
        try:
            stock = yf.Ticker(ticker.strip())
            info = stock.info
            price = info.get('currentPrice', 'Unknown')
            return f"Ticker: {ticker}\nCurrent Price: ${price}\n"
        except Exception as e:
            return f"Error fetching data: {str(e)}"

# 2. Human Input Tool
class WebHumanInputTool(BaseTool):
    name: str = "Ask Human for Help"
    description: str = "Ask the user for input. Useful when you need approval or missing details."
    websocket: Any = None 
    # We use a global store to hold the human's answer temporarily
    human_input_store: Dict[str, str] = {}

    def _run(self, question: str) -> str:
        request_id = f"req_{int(time.time())}"
        
        # Send the question to the Frontend via WebSocket
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.websocket.send_json({
                "type": "HUMAN_INPUT_REQUEST",
                "requestId": request_id,
                "content": question
            }))
            loop.close()
        except Exception as e:
            return "Error asking human."

        # Wait loop: Check every second if the human has answered
        print(f"WAITING for human input: {request_id}")
        while request_id not in self.human_input_store:
            time.sleep(1)
        
        # Return the answer to the Agent
        return self.human_input_store.pop(request_id)

# --- WEBSOCKET LOGGING ---
# This class "listens" to the Agent's brain and sends thoughts to the UI
# AND saves them to the database.
class WebSocketHandler(BaseCallbackHandler):
    def __init__(self, websocket: WebSocket, mission_id: int):
        self.websocket = websocket
        self.mission_id = mission_id

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> Any:
        # Log to DB
        add_event(self.mission_id, "Agent", "THOUGHT", "Thinking...")
        # Send to UI
        asyncio.run(self.websocket.send_json({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"}))

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> Any:
        content = f"Using Tool: {serialized.get('name')}"
        add_event(self.mission_id, "Agent", "ACTION", content)
        asyncio.run(self.websocket.send_json({"type": "ACTION", "content": content, "agentName": "Agent"}))

    def on_tool_end(self, output: str, **kwargs: Any) -> Any:
        content = f"Tool Output: {output[:200]}..."
        add_event(self.mission_id, "System", "OUTPUT", content)
        asyncio.run(self.websocket.send_json({"type": "OUTPUT", "content": content, "agentName": "System"}))

# --- TOOL MANAGER ---
def get_tools(tool_ids: List[str], websocket: WebSocket, human_enabled: bool, context_file_path: str = None):
    tools = []
    
    # Standard CrewAI Tools
    if "tool-search" in tool_ids:
        tools.append(SerperDevTool()) 
    if "tool-scrape" in tool_ids:
        tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids:
        tools.append(YoutubeChannelSearchTool())
        
    # Custom Tools
    if "tool-finance" in tool_ids:
        tools.append(CustomYahooFinanceTool())

    # --- NEW: PYTHON CODE TOOL ---
    if "tool-python" in tool_ids:
        # We wrap the LangChain tool into a format CrewAI accepts
        python_tool = PythonREPLTool()
        # CrewAI needs us to manually set the name if we wrap it differently, 
        # but PythonREPLTool usually works out of the box. 
        # We will wrap it in a custom class if needed, but let's try direct first.
        tools.append(python_tool)

    # Human Tool
    if human_enabled:
        human_tool = WebHumanInputTool()
        human_tool.websocket = websocket
        # Pass the global store reference so it can find the answer
        human_tool.human_input_store = human_input_store
        tools.append(human_tool)

    # File Reader
    if context_file_path:
        context_tool = FileReadTool(file_path=context_file_path)
        tools.append(context_tool)

    return tools

# Global store for human answers
human_input_store = {}

# --- API ENDPOINTS (HISTORY) ---

@app.get("/api/missions")
def list_missions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """Fetch list of past missions from DB"""
    missions = db.query(Mission).order_by(Mission.created_at.desc()).offset(skip).limit(limit).all()
    return missions

@app.get("/api/missions/{mission_id}")
def get_mission_details(mission_id: int, db: Session = Depends(get_db)):
    """Fetch details and logs for one mission"""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    events = db.query(MissionEvent).filter(MissionEvent.mission_id == mission_id).order_by(MissionEvent.timestamp.asc()).all()
    return {"mission": mission, "events": events}

# --- MAIN WEBSOCKET CONNECTION ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            raw_data = await websocket.receive_text()
            msg = json.loads(raw_data)

            # --- CASE 1: STARTING A NEW MISSION ---
            if msg.get("action") == "START_MISSION":
                data = msg["payload"]
                
                # A. Create Database Record
                goal_text = data['plan'][0]['instruction'] if data['plan'] else "Unknown Goal"
                mission_id = create_mission(goal=goal_text)

                # B. Handle Context File
                context_content = data.get("context", "")
                context_file_path = None
                if context_content:
                    os.makedirs("uploads", exist_ok=True)
                    # Check if it looks like JSON or CSV
                    ext = ".json" if context_content.strip().startswith("{") else ".txt"
                    context_file_path = f"uploads/mission_context_{int(time.time())}{ext}"
                    with open(context_file_path, "w", encoding="utf-8") as f:
                        f.write(context_content)

                # C. Setup AI Brain (LLM)
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing GEMINI_API_KEY"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key
                
                # Using the model you preferred
                llm = LLM(model="gemini/gemini-2.5-flash", temperature=0.7)

                # D. Create Agents
                crew_agents = {}
                for agent_data in data['agents']:
                    tools_list = get_tools(
                        agent_data.get('toolIds', []), 
                        websocket, 
                        agent_data.get('humanInput', False),
                        context_file_path
                    )
                    
                    new_agent = Agent(
                        role=agent_data['role'],
                        goal=agent_data['goal'],
                        backstory=agent_data['backstory'],
                        tools=tools_list,
                        llm=llm,
                        verbose=True,
                        allow_delegation=False,
                        callbacks=[WebSocketHandler(websocket, mission_id)]
                    )
                    crew_agents[agent_data['id']] = new_agent
                
                # E. Create Tasks
                crew_tasks = []
                for step in data['plan']:
                    agent = crew_agents.get(step['agentId']) or list(crew_agents.values())[0]
                    instruction = step['instruction']
                    if context_file_path:
                        instruction += " (Check the uploaded context file for data if needed)."
                    task = Task(description=instruction, expected_output="Report", agent=agent)
                    crew_tasks.append(task)

                # F. Create Crew
                crew = Crew(
                    agents=list(crew_agents.values()),
                    tasks=crew_tasks,
                    verbose=True,
                    process=Process.sequential
                )

                await websocket.send_json({"type": "SYSTEM", "content": "Mission Started."})

                # G. Run Mission
                loop = asyncio.get_event_loop()
                try:
                    result = await loop.run_in_executor(None, crew.kickoff)
                    
                    # Calculate Stats
                    usage = getattr(result, "token_usage", None) 
                    total_tokens = usage.total_tokens if usage else 0
                    cost = (total_tokens / 1_000_000) * 0.35

                    # Update DB
                    update_mission_result(mission_id, str(result), total_tokens, cost, "COMPLETED")
                except Exception as e:
                    update_mission_result(mission_id, str(e), 0, 0.0, "FAILED")
                    await websocket.send_json({"type": "ERROR", "content": f"Failed: {str(e)}"})
                    continue

                await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})
                
                # Cleanup File
                if context_file_path and os.path.exists(context_file_path):
                    os.remove(context_file_path)

            # --- CASE 2: HUMAN ANSWERING A QUESTION ---
            elif msg.get("action") == "HUMAN_RESPONSE":
                # Store the answer so the waiting tool can find it
                human_input_store[msg["requestId"]] = msg["content"]
                
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)