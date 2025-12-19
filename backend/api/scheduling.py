from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from core.database import create_scheduled_mission, get_scheduled_missions, ScheduledMission, SessionLocal
from core.database import create_mission
import json
import asyncio

router = APIRouter()

class ScheduleRequest(BaseModel):
    name: str
    goal: str
    plan: List[dict]
    agents: List[dict]
    schedule_type: str  # 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'WEBHOOK'
    schedule_config: dict
    webhook_url: Optional[str] = None

@router.post("/scheduling/create")
async def create_schedule(request: ScheduleRequest):
    """Create a scheduled mission."""
    try:
        schedule_id = create_scheduled_mission(
            name=request.name,
            goal=request.goal,
            plan=request.plan,
            agents=request.agents,
            schedule_type=request.schedule_type,
            schedule_config=request.schedule_config,
            webhook_url=request.webhook_url
        )
        return {"status": "success", "schedule_id": schedule_id}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/scheduling/list")
async def list_schedules(active_only: bool = True):
    """List all scheduled missions."""
    try:
        schedules = get_scheduled_missions(active_only=active_only)
        result = []
        for s in schedules:
            result.append({
                "id": s.id,
                "name": s.name,
                "goal": s.goal,
                "schedule_type": s.schedule_type,
                "is_active": s.is_active,
                "next_run": s.next_run.isoformat() if s.next_run else None,
                "created_at": s.created_at.isoformat()
            })
        return {"schedules": result}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/scheduling/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: int):
    """Toggle schedule active status."""
    db = SessionLocal()
    try:
        schedule = db.query(ScheduledMission).filter(ScheduledMission.id == schedule_id).first()
        if not schedule:
            raise HTTPException(404, "Schedule not found")
        schedule.is_active = not schedule.is_active
        db.commit()
        return {"status": "success", "is_active": schedule.is_active}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.delete("/scheduling/{schedule_id}")
async def delete_schedule(schedule_id: int):
    """Delete a scheduled mission."""
    db = SessionLocal()
    try:
        schedule = db.query(ScheduledMission).filter(ScheduledMission.id == schedule_id).first()
        if not schedule:
            raise HTTPException(404, "Schedule not found")
        db.delete(schedule)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.post("/scheduling/webhook/{schedule_id}")
async def trigger_webhook_mission(schedule_id: int):
    """Trigger a webhook-scheduled mission."""
    db = SessionLocal()
    try:
        schedule = db.query(ScheduledMission).filter(
            ScheduledMission.id == schedule_id,
            ScheduledMission.schedule_type == "WEBHOOK",
            ScheduledMission.is_active == True
        ).first()
        if not schedule:
            raise HTTPException(404, "Webhook schedule not found or inactive")
        
        # Create mission from schedule
        mission_id = create_mission(schedule.goal)
        # Note: Actual execution would be handled by the websocket handler
        # This is just the trigger endpoint
        
        return {"status": "triggered", "mission_id": mission_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()
