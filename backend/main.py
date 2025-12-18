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

# WebSocket Endpoint
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
    
    llm = ChatGoogleGenerativeAI(model="gemini/gemini-2.0-flash", google_api_key=api_key, temperature=0.7)
    
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
                
                # Setup Env
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing API Key"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key
                os.environ["OPENAI_API_KEY"] = "NA" # CrewAI fix
                
                llm = LLM(model="gemini/gemini-2.0-flash", temperature=0.7)
                
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
