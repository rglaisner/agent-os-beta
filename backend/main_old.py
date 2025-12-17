import json
import os
import asyncio
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- CREWAI IMPORTS ---
from crewai import Agent, Task, Crew, Process, LLM
# Import tools (add more here as you need them)
from crewai_tools import SerperDevTool, FileReadTool

# Initialize App
app = FastAPI()

# Allow connections from your React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
# These match the JSON sent from your React frontend
class AgentModel(BaseModel):
    id: str
    name: str
    role: str
    goal: str
    backstory: str
    toolIds: List[str] = []

class StepModel(BaseModel):
    id: str
    agentId: str
    instruction: str

class MissionPayload(BaseModel):
    agents: List[AgentModel]
    plan: List[StepModel]
    process: str = "sequential" 

# --- TOOL FACTORY ---
def get_tools(tool_ids: List[str]):
    """Converts string IDs from frontend to actual Python tool objects"""
    tools = []
    # If the agent has 'tool-search' assigned, give them the real SerperDevTool
    if "tool-search" in tool_ids:
        tools.append(SerperDevTool()) 
    if "tool-file-read" in tool_ids:
        tools.append(FileReadTool())
    return tools

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected via WebSocket")
    
    try:
        # 1. Receive the Mission Data
        raw_data = await websocket.receive_text()
        data = json.loads(raw_data)
        
        # 2. Setup the LLM (Gemini)
        # Note: We rely on the system environment variable for the API key
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            await websocket.send_json({"type": "ERROR", "content": "Server missing GEMINI_API_KEY env variable."})
            return

        llm = LLM(
            model="gemini/gemini-2.0-flash",
            temperature=0.7
        )

        # 3. Reconstruct Agents
        crew_agents = {}
        for agent_data in data['agents']:
            new_agent = Agent(
                role=agent_data['role'],
                goal=agent_data['goal'],
                backstory=agent_data['backstory'],
                tools=get_tools(agent_data.get('toolIds', [])),
                llm=llm,
                verbose=True,
                allow_delegation=False
            )
            crew_agents[agent_data['id']] = new_agent
        
        # 4. Reconstruct Tasks
        crew_tasks = []
        for step in data['plan']:
            # Find the assigned agent, or default to the first one if missing
            agent = crew_agents.get(step['agentId'])
            if not agent:
                agent = list(crew_agents.values())[0]

            task = Task(
                description=step['instruction'],
                expected_output="Detailed execution report.",
                agent=agent
            )
            crew_tasks.append(task)

        # 5. Create the Crew
        # LOGIC CHANGE: Check if hierarchical
        is_hierarchical = (data.get('process') == 'hierarchical')
        
        crew = Crew(
            agents=list(crew_agents.values()),
            tasks=crew_tasks,
            verbose=True,
            process=Process.hierarchical if is_hierarchical else Process.sequential,
            manager_llm=llm if is_hierarchical else None # <--- CRITICAL: Manager needs a brain
        )

        # 6. Run Execution
        await websocket.send_json({
            "type": "SYSTEM", 
            "content": "Backend initialized. Starting CrewAI execution..."
        })

        # Run blocking CrewAI code in a separate thread so we don't freeze the server
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff)

        # 7. Send Final Result
        await websocket.send_json({
            "type": "OUTPUT", 
            "content": str(result),
            "agentName": "System"
        })
        
        await websocket.send_json({
            "type": "SYSTEM", 
            "content": "Mission Complete."
        })
        
        # Close connection nicely
        await websocket.close()

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        # Try to send error to client if still connected
        try:
            await websocket.send_json({"type": "ERROR", "content": str(e)})
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)