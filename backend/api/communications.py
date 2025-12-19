from fastapi import APIRouter, HTTPException
from core.database import get_mission_communications, add_communication_log
from typing import List, Dict

router = APIRouter()

@router.get("/communications/{mission_id}")
async def get_communications(mission_id: int):
    """Get all agent communications for a mission."""
    try:
        logs = get_mission_communications(mission_id)
        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "from_agent": log.from_agent,
                "to_agent": log.to_agent,
                "message_type": log.message_type,
                "content": log.content,
                "metadata": log.metadata
            })
        return {"communications": result}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/communications/{mission_id}/patterns")
async def analyze_communication_patterns(mission_id: int):
    """Analyze communication patterns for a mission."""
    try:
        logs = get_mission_communications(mission_id)
        
        # Analyze patterns
        agent_interactions = {}
        message_type_counts = {}
        communication_flow = []
        
        for log in logs:
            # Track agent interactions
            key = f"{log.from_agent}->{log.to_agent or 'ALL'}"
            if key not in agent_interactions:
                agent_interactions[key] = 0
            agent_interactions[key] += 1
            
            # Count message types
            if log.message_type not in message_type_counts:
                message_type_counts[log.message_type] = 0
            message_type_counts[log.message_type] += 1
            
            # Build communication flow
            communication_flow.append({
                "timestamp": log.timestamp.isoformat(),
                "from": log.from_agent,
                "to": log.to_agent,
                "type": log.message_type
            })
        
        return {
            "agent_interactions": agent_interactions,
            "message_type_distribution": message_type_counts,
            "communication_flow": communication_flow,
            "total_communications": len(logs),
            "unique_agents": len(set([log.from_agent for log in logs] + [log.to_agent for log in logs if log.to_agent]))
        }
    except Exception as e:
        raise HTTPException(500, str(e))
