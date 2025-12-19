import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import List, Dict, Any

router = APIRouter()

class AgentSuggestionRequest(BaseModel):
    goal: str
    available_agents: List[dict]
    available_tools: List[str]

@router.post("/suggestions/agents")
async def suggest_agents(request: AgentSuggestionRequest):
    """AI-powered agent recommendations based on goal."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(500, "Missing API Key")
    
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.7)
    
    agent_descriptions = "\n".join([f"- {a.get('role', 'Unknown')}: {a.get('goal', '')}" for a in request.available_agents])
    tools_list = ", ".join(request.available_tools)
    
    prompt = f"""
    Analyze this mission goal and recommend the best agents and tools to use.
    
    GOAL: {request.goal}
    
    AVAILABLE AGENTS:
    {agent_descriptions}
    
    AVAILABLE TOOLS: {tools_list}
    
    Return a JSON object with:
    {{
        "recommended_agents": [
            {{"id": "agent-id", "reason": "why this agent is recommended"}}
        ],
        "suggested_tools": [
            {{"tool_id": "tool-id", "reason": "why this tool is useful"}}
        ],
        "agent_composition": {{
            "structure": "sequential" or "hierarchical",
            "reason": "explanation of why this structure works best"
        }},
        "alternative_approaches": [
            "alternative approach 1",
            "alternative approach 2"
        ]
    }}
    
    Return ONLY the JSON object.
    """
    
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data
    except Exception as e:
        raise HTTPException(500, f"Error generating suggestions: {str(e)}")

@router.post("/suggestions/tools")
async def suggest_tools(request: AgentSuggestionRequest):
    """Automatic tool assignment suggestions for agents."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(500, "Missing API Key")
    
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.7)
    
    agent_descriptions = "\n".join([f"- {a.get('id')}: {a.get('role')} - {a.get('goal')}" for a in request.available_agents])
    tools_list = ", ".join(request.available_tools)
    
    prompt = f"""
    Suggest optimal tool assignments for each agent based on the mission goal.
    
    GOAL: {request.goal}
    
    AGENTS:
    {agent_descriptions}
    
    AVAILABLE TOOLS: {tools_list}
    
    Return a JSON object:
    {{
        "tool_assignments": [
            {{
                "agent_id": "agent-id",
                "recommended_tools": ["tool1", "tool2"],
                "reason": "explanation"
            }}
        ],
        "optimization_suggestions": [
            "suggestion 1",
            "suggestion 2"
        ]
    }}
    
    Return ONLY the JSON object.
    """
    
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data
    except Exception as e:
        raise HTTPException(500, f"Error generating tool suggestions: {str(e)}")

@router.post("/suggestions/composition")
async def optimize_composition(request: AgentSuggestionRequest):
    """Agent composition optimization."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(500, "Missing API Key")
    
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key, temperature=0.7)
    
    agent_descriptions = "\n".join([f"- {a.get('id')}: {a.get('role')} - {a.get('goal')}" for a in request.available_agents])
    
    prompt = f"""
    Optimize the agent composition for this mission goal.
    
    GOAL: {request.goal}
    
    AVAILABLE AGENTS:
    {agent_descriptions}
    
    Return a JSON object:
    {{
        "optimal_structure": "sequential" or "hierarchical",
        "agent_order": ["agent-id-1", "agent-id-2"],
        "reasoning": "detailed explanation",
        "estimated_efficiency": "high/medium/low",
        "potential_bottlenecks": ["bottleneck 1", "bottleneck 2"],
        "improvements": ["improvement 1", "improvement 2"]
    }}
    
    Return ONLY the JSON object.
    """
    
    try:
        res = llm.invoke(prompt)
        text = res.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data
    except Exception as e:
        raise HTTPException(500, f"Error optimizing composition: {str(e)}")
