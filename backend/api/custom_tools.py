from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from core.database import create_custom_tool, get_custom_tools, CustomTool, SessionLocal
from datetime import datetime
import json

router = APIRouter()

class CustomToolRequest(BaseModel):
    name: str
    description: str
    tool_type: str  # 'FUNCTION', 'API', 'SCRIPT'
    code: str
    parameters: Dict
    test_cases: Optional[List[Dict]] = None

@router.post("/tools/custom/create")
async def create_tool(request: CustomToolRequest):
    """Create a custom tool."""
    try:
        tool_id = create_custom_tool(
            name=request.name,
            description=request.description,
            tool_type=request.tool_type,
            code=request.code,
            parameters=request.parameters,
            test_cases=request.test_cases
        )
        return {"status": "success", "tool_id": tool_id}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/tools/custom/list")
async def list_custom_tools(active_only: bool = True):
    """List all custom tools."""
    try:
        tools = get_custom_tools(active_only=active_only)
        result = []
        for t in tools:
            result.append({
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "tool_type": t.tool_type,
                "is_active": t.is_active,
                "created_at": t.created_at.isoformat(),
                "last_tested": t.last_tested.isoformat() if t.last_tested else None
            })
        return {"tools": result}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/tools/custom/{tool_id}/test")
async def test_custom_tool(tool_id: int):
    """Test a custom tool with its test cases."""
    db = SessionLocal()
    try:
        tool = db.query(CustomTool).filter(CustomTool.id == tool_id).first()
        if not tool:
            raise HTTPException(404, "Tool not found")
        
        test_results = []
        if tool.test_cases:
            for test_case in tool.test_cases:
                try:
                    # Execute tool code with test case
                    # This is a simplified version - in production, use proper sandboxing
                    test_input = test_case.get("input", {})
                    expected_output = test_case.get("expected_output")
                    
                    # Execute the tool (simplified - should use proper sandboxing)
                    # For now, just mark as "needs_implementation"
                    test_results.append({
                        "test_case": test_case,
                        "status": "pending",
                        "message": "Tool testing requires sandboxed execution environment"
                    })
                except Exception as e:
                    test_results.append({
                        "test_case": test_case,
                        "status": "failed",
                        "error": str(e)
                    })
        
        tool.last_tested = datetime.utcnow()
        tool.test_results = test_results
        db.commit()
        
        return {"status": "completed", "test_results": test_results}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.post("/tools/custom/{tool_id}/toggle")
async def toggle_tool(tool_id: int):
    """Toggle tool active status."""
    db = SessionLocal()
    try:
        tool = db.query(CustomTool).filter(CustomTool.id == tool_id).first()
        if not tool:
            raise HTTPException(404, "Tool not found")
        tool.is_active = not tool.is_active
        db.commit()
        return {"status": "success", "is_active": tool.is_active}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.delete("/tools/custom/{tool_id}")
async def delete_tool(tool_id: int):
    """Delete a custom tool."""
    db = SessionLocal()
    try:
        tool = db.query(CustomTool).filter(CustomTool.id == tool_id).first()
        if not tool:
            raise HTTPException(404, "Tool not found")
        db.delete(tool)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        db.close()
