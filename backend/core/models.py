from typing import List, Any, Optional, Dict
from pydantic import BaseModel


class AgentConfig(BaseModel):
    reasoning: Optional[bool] = False
    max_reasoning_attempts: Optional[int] = None
    max_iter: Optional[int] = None


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
    agents: List[AgentModel]
    process_type: Optional[str] = "sequential"


class PlanResponse(BaseModel):
    plan: List[PlanStep]
    newAgents: List[AgentModel]
    agentConfigs: Optional[Dict[str, AgentConfig]] = None
    narrative: Optional[str] = None
