import json
import os
import asyncio
import time
import shutil
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import yfinance as yf

# Database Imports
from database import init_db, create_mission, add_event, update_mission_result, SessionLocal, Mission, MissionEvent

# AI Imports
from crewai import Agent, Task, Crew, Process, LLM
from langchain_core.callbacks import BaseCallbackHandler
from crewai.tools import BaseTool
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool, YoutubeChannelSearchTool, PDFSearchTool
from langchain_experimental.tools import PythonREPLTool
from langchain_google_genai import ChatGoogleGenerativeAI

app = FastAPI()

# Initialize DB & Uploads Folder
init_db()
os.makedirs("uploads", exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class PlanRequest(BaseModel):
    goal: str
    agents: List[Any]

# --- DEPENDENCIES ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- NEW: FILE UPLOAD ENDPOINT ---
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Handles uploading large files (PDF, CSV, Excel)"""
    try:
        # Generate safe unique filename
        file_ext = os.path.splitext(file.filename)[1]
        safe_name = f"doc_{int(time.time())}{file_ext}"
        file_path = os.path.join("uploads", safe_name)
        
        # Save to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"filename": file.filename, "server_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- GENERATE PLAN ---
@app.post("/api/plan")
async def generate_plan(request: PlanRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: raise HTTPException(500, "Missing API Key")
    
    llm = ChatGoogleGenerativeAI(model="gemini/gemini-2.5-flash", google_api_key=api_key, temperature=0.7)
    
    agent_desc = "\n".join([f"- {a['role']} (Tools: {a['toolIds']})" for a in request.agents])
    prompt = f"""
    You are an expert project manager. Create a step-by-step execution plan for: "{request.goal}"
    Available Agents:
    {agent_desc}
    Return ONLY a JSON array: [{{ "id": "step-1", "agentId": "agent-id", "instruction": "Step details" }}]
    """
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, str(e))

# --- CUSTOM TOOLS ---
class CustomYahooFinanceTool(BaseTool):
    name: str = "Yahoo Finance Tool"
    description: str = "Get stock price. Input: ticker (e.g. 'AAPL')."
    def _run(self, ticker: str) -> str:
        try:
            return f"${yf.Ticker(ticker.strip()).info.get('currentPrice', 'Unknown')}"
        except: return "Error."

class WebHumanInputTool(BaseTool):
    name: str = "Ask Human"
    description: str = "Ask user for input."
    websocket: Any = None 
    human_input_store: Dict[str, str] = {}
    def _run(self, question: str) -> str:
        req_id = f"req_{int(time.time())}"
        asyncio.run(self.websocket.send_json({"type": "HUMAN_INPUT_REQUEST", "requestId": req_id, "content": question}))
        while req_id not in self.human_input_store: time.sleep(1)
        return self.human_input_store.pop(req_id)

human_input_store = {}

# --- WEBSOCKET HANDLER ---
class WebSocketHandler(BaseCallbackHandler):
    def __init__(self, websocket: WebSocket, mission_id: int):
        self.websocket = websocket
        self.mission_id = mission_id
    def on_llm_start(self, serialized, prompts, **kwargs):
        asyncio.run(self.websocket.send_json({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"}))
    def on_tool_start(self, serialized, input_str, **kwargs):
        msg = f"Using {serialized.get('name')}"
        add_event(self.mission_id, "Agent", "ACTION", msg)
        asyncio.run(self.websocket.send_json({"type": "ACTION", "content": msg, "agentName": "Agent"}))
    def on_tool_end(self, output, **kwargs):
        add_event(self.mission_id, "System", "OUTPUT", output[:200])
        asyncio.run(self.websocket.send_json({"type": "OUTPUT", "content": output[:200], "agentName": "System"}))

def get_tools(tool_ids, websocket, human_enabled, file_paths):
    tools = []
    # Standard
    if "tool-search" in tool_ids: tools.append(SerperDevTool()) 
    if "tool-scrape" in tool_ids: tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids: tools.append(YoutubeChannelSearchTool())
    if "tool-finance" in tool_ids: tools.append(CustomYahooFinanceTool())
    if "tool-python" in tool_ids: tools.append(PythonREPLTool())
    
    # Human
    if human_enabled:
        h = WebHumanInputTool()
        h.websocket = websocket
        h.human_input_store = human_input_store
        tools.append(h)
        
    # File Tools - We give agents access to read the uploaded files
    if file_paths:
        for path in file_paths:
            # If PDF, use PDF Search, otherwise generic File Read
            if path.endswith(".pdf"):
                tools.append(PDFSearchTool(pdf=path))
            else:
                tools.append(FileReadTool(file_path=path))

    return tools

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
                
                # Setup Environment
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing API Key"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key
                os.environ["OPENAI_API_KEY"] = "NA" # CrewAI fix
                
                llm = LLM(model="gemini/gemini-1.5-flash", temperature=0.7)
                
                # Handle Files
                # The frontend sends us a list of "server_path" strings for uploaded files
                uploaded_files = payload.get("files", [])

                # Create Agents
                agents_map = {}
                tasks = []
                for a_data in payload['agents']:
                    # Pass the file paths to the tools
                    tools = get_tools(a_data['toolIds'], websocket, a_data.get('humanInput'), uploaded_files)
                    
                    # Augment Backstory so agent knows about the file
                    backstory = a_data['backstory']
                    if uploaded_files:
                        backstory += f"\n\nNOTICE: You have access to these files: {uploaded_files}. Use your tools to read them if needed."

                    agent = Agent(role=a_data['role'], goal=a_data['goal'], backstory=backstory, tools=tools, llm=llm, callbacks=[WebSocketHandler(websocket, mission_id)])
                    agents_map[a_data['id']] = agent
                
                # Create Tasks
                for step in payload['plan']:
                    agent = agents_map.get(step['agentId']) or list(agents_map.values())[0]
                    desc = step['instruction']
                    if uploaded_files:
                        desc += f" (Refer to attached files: {uploaded_files})"
                    tasks.append(Task(description=desc, expected_output="Report", agent=agent))

                # Kickoff
                await websocket.send_json({"type": "SYSTEM", "content": "Mission Started"})
                try:
                    crew = Crew(agents=list(agents_map.values()), tasks=tasks, process=Process.sequential)
                    result = await asyncio.get_event_loop().run_in_executor(None, crew.kickoff)
                    update_mission_result(mission_id, str(result))
                    await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})
                except Exception as e:
                    update_mission_result(mission_id, str(e), status="FAILED")
                    await websocket.send_json({"type": "ERROR", "content": str(e)})

            elif data.get("action") == "HUMAN_RESPONSE":
                human_input_store[data["requestId"]] = data["content"]
    except:
        print("WS Disconnect")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)