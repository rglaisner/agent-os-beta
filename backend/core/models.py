from typing import List, Any, Optional
from pydantic import BaseModel

class AgentModel(BaseModel):
    id: str
    role: str
    goal: str
    backstory: str
    toolIds: List[str]
    humanInput: bool
    reasoning: Optional[bool] = False
    max_reasoning_attempts: Optional[int] = None
    max_iter: Optional[int] = None

class PlanStep(BaseModel):
    id: str
    agentId: str
    instruction: str
    trainingIterations: Optional[int] = 0

class PlanRequest(BaseModel):
    goal: str
    agents: List[dict] # Simplified for now, can be stricter
    process_type: Optional[str] = "sequential"

class PlanResponse(BaseModel):
    plan: List[PlanStep]
    newAgents: List[AgentModel]
    agentConfigs: Optional[dict] = None
    narrative: Optional[str] = None
