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

# Database Imports
from database import init_db, create_mission, add_event, update_mission_result, SessionLocal, Mission, MissionEvent

# AI Imports
from crewai import Agent, Task, Crew, Process, LLM
from langchain_core.callbacks import BaseCallbackHandler
from crewai.tools import BaseTool
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool, YoutubeChannelSearchTool
from langchain_experimental.tools import PythonREPLTool

# Google Generative AI (Direct import for simple planning tasks)
import google.generativeai as genai

app = FastAPI()

# Initialize DB
init_db()

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

# --- HELPER: CONFIGURE GEMINI ---
def configure_genai():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found.")
        return None
    genai.configure(api_key=api_key)
    return True

# --- NEW ENDPOINT: GENERATE PLAN ---
@app.post("/api/plan")
async def generate_plan(request: PlanRequest):
    """Generates a mission plan using the Backend's API Key"""
    if not configure_genai():
        raise HTTPException(status_code=500, detail="Server missing API Key")
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Construct the prompt
    agent_descriptions = "\n".join([f"- {a['role']} (Tools: {a['toolIds']})" for a in request.agents])
    prompt = f"""
    You are an expert project manager. Create a step-by-step execution plan for the following goal:
    "{request.goal}"
    
    Available Agents:
    {agent_descriptions}
    
    Return ONLY a JSON array of steps. No markdown, no text.
    Format: [{{ "id": "step-1", "agentId": "agent-id", "instruction": "Step details" }}]
    """
    
    try:
        response = model.generate_content(prompt)
        # Clean the response to ensure it's pure JSON
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"Planning Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- CUSTOM TOOLS ---
class CustomYahooFinanceTool(BaseTool):
    name: str = "Yahoo Finance Tool"
    description: str = "Get stock price. Input: ticker (e.g. 'AAPL')."
    def _run(self, ticker: str) -> str:
        try:
            stock = yf.Ticker(ticker.strip())
            return f"${stock.info.get('currentPrice', 'Unknown')}"
        except: return "Error fetching price."

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
        add_event(self.mission_id, "Agent", "THOUGHT", "Thinking...")
        asyncio.run(self.websocket.send_json({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"}))
    def on_tool_start(self, serialized, input_str, **kwargs):
        add_event(self.mission_id, "Agent", "ACTION", f"Tool: {serialized.get('name')}")
        asyncio.run(self.websocket.send_json({"type": "ACTION", "content": f"Tool: {serialized.get('name')}", "agentName": "Agent"}))
    def on_tool_end(self, output, **kwargs):
        add_event(self.mission_id, "System", "OUTPUT", output[:200])
        asyncio.run(self.websocket.send_json({"type": "OUTPUT", "content": output[:200], "agentName": "System"}))

def get_tools(tool_ids, websocket, human_enabled, context_file):
    tools = []
    if "tool-search" in tool_ids: tools.append(SerperDevTool()) 
    if "tool-scrape" in tool_ids: tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids: tools.append(YoutubeChannelSearchTool())
    if "tool-finance" in tool_ids: tools.append(CustomYahooFinanceTool())
    if "tool-python" in tool_ids: tools.append(PythonREPLTool())
    if human_enabled:
        h = WebHumanInputTool()
        h.websocket = websocket
        h.human_input_store = human_input_store
        tools.append(h)
    if context_file: tools.append(FileReadTool(file_path=context_file))
    return tools

# --- HISTORY API ---
@app.get("/api/missions")
def list_missions(db: Session = Depends(get_db)):
    return db.query(Mission).order_by(Mission.created_at.desc()).limit(20).all()

@app.get("/api/missions/{mission_id}")
def get_mission_details(mission_id: int, db: Session = Depends(get_db)):
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m: raise HTTPException(404, "Not found")
    events = db.query(MissionEvent).filter(MissionEvent.mission_id == mission_id).all()
    return {"mission": m, "events": events}

# --- WEBSOCKET ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "START_MISSION":
                payload = data["payload"]
                mission_id = create_mission(payload['plan'][0]['instruction'][:50])
                
                # Context File
                context_file = None
                if payload.get("context"):
                    os.makedirs("uploads", exist_ok=True)
                    context_file = f"uploads/ctx_{int(time.time())}.txt"
                    with open(context_file, "w") as f: f.write(payload["context"])

                configure_genai()
                llm = LLM(model="gemini/gemini-1.5-flash", temperature=0.7)
                
                # Agents & Tasks
                agents_map = {}
                tasks = []
                for a_data in payload['agents']:
                    tools = get_tools(a_data['toolIds'], websocket, a_data.get('humanInput'), context_file)
                    agent = Agent(role=a_data['role'], goal=a_data['goal'], backstory=a_data['backstory'], tools=tools, llm=llm, callbacks=[WebSocketHandler(websocket, mission_id)])
                    agents_map[a_data['id']] = agent
                
                for step in payload['plan']:
                    agent = agents_map.get(step['agentId']) or list(agents_map.values())[0]
                    tasks.append(Task(description=step['instruction'], expected_output="Result", agent=agent))

                # Execution
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