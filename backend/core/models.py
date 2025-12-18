from typing import List, Any, Optional
from pydantic import BaseModel

class AgentModel(BaseModel):
    id: str
    role: str
    goal: str
    backstory: str
    toolIds: List[str]
    humanInput: bool

class PlanStep(BaseModel):
    id: str
    agentId: str
    instruction: str

class PlanRequest(BaseModel):
    goal: str
    agents: List[dict] # Simplified for now, can be stricter
    process_type: Optional[str] = "sequential"

class PlanResponse(BaseModel):
    plan: List[PlanStep]
    newAgents: List[AgentModel]
