from fastapi import APIRouter, HTTPException, Response
from core.database import get_mission, get_mission_communications, MissionEvent
from sqlalchemy.orm import Session
from core.database import SessionLocal
from typing import Optional
import json
from datetime import datetime

router = APIRouter()

@router.get("/export/{mission_id}/json")
async def export_json(mission_id: int):
    """Export mission results as JSON."""
    db = SessionLocal()
    try:
        mission = get_mission(mission_id)
        if not mission:
            raise HTTPException(404, "Mission not found")
        
        events = db.query(MissionEvent).filter(MissionEvent.mission_id == mission_id).order_by(MissionEvent.timestamp).all()
        communications = get_mission_communications(mission_id)
        
        export_data = {
            "mission": {
                "id": mission.id,
                "goal": mission.goal,
                "status": mission.status,
                "result": mission.result,
                "created_at": mission.created_at.isoformat(),
                "completed_at": mission.completed_at.isoformat() if mission.completed_at else None,
                "total_tokens": mission.total_tokens,
                "estimated_cost": mission.estimated_cost,
                "execution_time": mission.execution_time,
                "category": mission.category
            },
            "events": [
                {
                    "timestamp": e.timestamp.isoformat(),
                    "agent_name": e.agent_name,
                    "type": e.type,
                    "content": e.content
                }
                for e in events
            ],
            "communications": [
                {
                    "timestamp": c.timestamp.isoformat(),
                    "from_agent": c.from_agent,
                    "to_agent": c.to_agent,
                    "message_type": c.message_type,
                    "content": c.content,
                    "metadata": c.metadata
                }
                for c in communications
            ]
        }
        
        return Response(
            content=json.dumps(export_data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=mission_{mission_id}.json"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.get("/export/{mission_id}/markdown")
async def export_markdown(mission_id: int):
    """Export mission results as Markdown."""
    db = SessionLocal()
    try:
        mission = get_mission(mission_id)
        if not mission:
            raise HTTPException(404, "Mission not found")
        
        events = db.query(MissionEvent).filter(MissionEvent.mission_id == mission_id).order_by(MissionEvent.timestamp).all()
        
        markdown = f"""# Mission Report: {mission.goal}

## Mission Details
- **Status**: {mission.status}
- **Created**: {mission.created_at.strftime('%Y-%m-%d %H:%M:%S')}
- **Completed**: {mission.completed_at.strftime('%Y-%m-%d %H:%M:%S') if mission.completed_at else 'N/A'}
- **Execution Time**: {mission.execution_time:.2f}s if mission.execution_time else 'N/A'
- **Total Tokens**: {mission.total_tokens:,}
- **Estimated Cost**: ${mission.estimated_cost:.4f}

## Result
{mission.result or 'No result available'}

## Execution Timeline

"""
        for event in events:
            markdown += f"### {event.timestamp.strftime('%H:%M:%S')} - {event.agent_name} ({event.type})\n\n"
            markdown += f"{event.content}\n\n"
        
        return Response(
            content=markdown,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=mission_{mission_id}.md"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.get("/export/{mission_id}/pdf")
async def export_pdf(mission_id: int):
    """Export mission results as PDF."""
    # Note: This requires a PDF library like reportlab or weasyprint
    # For now, return a placeholder response
    try:
        mission = get_mission(mission_id)
        if not mission:
            raise HTTPException(404, "Mission not found")
        
        # In production, use a PDF library to generate the PDF
        # For now, return a message indicating PDF export needs implementation
        return {"message": "PDF export requires additional dependencies. Use Markdown or JSON export for now."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
