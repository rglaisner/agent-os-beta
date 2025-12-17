import json
import os
import asyncio
import time
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- CORRECT IMPORTS ---
from crewai import Agent, Task, Crew, Process, LLM
# Fix 1: Correct callback import
from langchain_core.callbacks import BaseCallbackHandler
# Fix 2: Correct Tool imports
from crewai.tools import BaseTool 
from crewai_tools import (
    SerperDevTool, 
    FileReadTool, 
    ScrapeWebsiteTool, 
    YoutubeChannelSearchTool
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Store for Human Input
human_input_store = {}

# --- 1. TOOLS (Human & RAG) ---
class WebHumanInputTool(BaseTool):
    name: str = "Ask Human for Help"
    description: str = "Useful to ask the human user for approval, feedback, or missing information. Input should be the question you want to ask."
    websocket: Any = None 

    def _run(self, question: str) -> str:
        # Generate ID
        request_id = f"req_{int(time.time())}"
        
        # Send Request
        try:
            # We create a new loop to handle the async send inside this sync tool
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.websocket.send_json({
                "type": "HUMAN_INPUT_REQUEST",
                "requestId": request_id,
                "content": question
            }))
            loop.close()
        except Exception as e:
            print(f"Tool Error: {e}")
            return "Error asking human."

        # Wait for reply
        print(f"WAITING for human input: {request_id}")
        while request_id not in human_input_store:
            time.sleep(1)
        
        return human_input_store.pop(request_id)

# --- 2. WEBSOCKET HANDLER (Live Logs) ---
class WebSocketHandler(BaseCallbackHandler):
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> Any:
        asyncio.run(self.websocket.send_json({"type": "THOUGHT", "content": "Thinking...", "agentName": "Agent"}))

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> Any:
        asyncio.run(self.websocket.send_json({"type": "ACTION", "content": f"Using Tool: {serialized.get('name')}", "agentName": "Agent"}))

    def on_tool_end(self, output: str, **kwargs: Any) -> Any:
        asyncio.run(self.websocket.send_json({"type": "OUTPUT", "content": f"Output: {output[:200]}...", "agentName": "System"}))

# --- HELPER: Get Tools ---
def get_tools(tool_ids: List[str], websocket: WebSocket, human_enabled: bool, context_file_path: str = None):
    tools = []
    
    # --- STANDARD LIBRARY ---
    if "tool-search" in tool_ids:
        tools.append(SerperDevTool()) 
    
    if "tool-scrape" in tool_ids:
        tools.append(ScrapeWebsiteTool())
        
    if "tool-finance" in tool_ids:
        tools.append(YahooFinanceNewsTool())
        
    if "tool-youtube" in tool_ids:
        tools.append(YoutubeChannelSearchTool())

    # --- SPECIAL TOOLS ---
    if human_enabled:
        human_tool = WebHumanInputTool()
        human_tool.websocket = websocket
        tools.append(human_tool)

    if context_file_path:
        context_tool = FileReadTool(file_path=context_file_path)
        tools.append(context_tool)

    return tools

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("New Client Connected!") # <--- PRINT DEBUG
    
    try:
        while True:
            raw_data = await websocket.receive_text()
            msg = json.loads(raw_data)

            if msg.get("action") == "START_MISSION":
                print("Starting Mission...") # <--- PRINT DEBUG
                data = msg["payload"]
                
                # Context File Handling
                context_content = data.get("context", "")
                context_file_path = None
                if context_content:
                    os.makedirs("uploads", exist_ok=True)
                    context_file_path = f"uploads/mission_context_{int(time.time())}.txt"
                    with open(context_file_path, "w", encoding="utf-8") as f:
                        f.write(context_content)

                # API Key
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    await websocket.send_json({"type": "ERROR", "content": "Missing GEMINI_API_KEY"})
                    continue
                os.environ["GOOGLE_API_KEY"] = api_key
                
                llm = LLM(model="gemini/gemini-1.5-flash", temperature=0.7)

                # Agents
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
                        callbacks=[WebSocketHandler(websocket)]
                    )
                    crew_agents[agent_data['id']] = new_agent
                
                # Tasks
                crew_tasks = []
                for step in data['plan']:
                    agent = crew_agents.get(step['agentId']) or list(crew_agents.values())[0]
                    instruction = step['instruction']
                    if context_file_path:
                        instruction += " (Check the uploaded context file for data if needed)."
                    task = Task(description=instruction, expected_output="Report", agent=agent)
                    crew_tasks.append(task)

                # Crew
                crew = Crew(
                    agents=list(crew_agents.values()),
                    tasks=crew_tasks,
                    verbose=True,
                    process=Process.sequential,
                    memory=True, 
                    embedder={
                        "provider": "google",
                        "config": {"model": "models/embedding-001", "api_key": api_key}
                    }
                )

                await websocket.send_json({"type": "SYSTEM", "content": "Mission Started."})

                # Execution
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, crew.kickoff)

                await websocket.send_json({"type": "OUTPUT", "content": str(result), "agentName": "System"})
                
                # Cleanup
                if context_file_path and os.path.exists(context_file_path):
                    os.remove(context_file_path)

            elif msg.get("action") == "HUMAN_RESPONSE":
                print(f"Received Human Response: {msg['content']}")
                human_input_store[msg["requestId"]] = msg["content"]
                
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    print("Attempting to start server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)