from fastapi import APIRouter, HTTPException
from sqlalchemy import func, and_
from core.database import SessionLocal, Mission, AgentCommunicationLog
from typing import List, Dict, Any
from datetime import datetime, timedelta
import json

router = APIRouter()

@router.get("/analytics/success-rates")
async def get_success_rates():
    """Get success rate per agent type."""
    db = SessionLocal()
    try:
        missions = db.query(Mission).filter(Mission.status.in_(["COMPLETED", "FAILED"])).all()
        
        agent_type_stats = {}
        for mission in missions:
            if mission.agent_types:
                try:
                    agent_types = json.loads(mission.agent_types) if isinstance(mission.agent_types, str) else mission.agent_types
                    for agent_type in agent_types:
                        if agent_type not in agent_type_stats:
                            agent_type_stats[agent_type] = {"total": 0, "success": 0}
                        agent_type_stats[agent_type]["total"] += 1
                        if mission.status == "COMPLETED":
                            agent_type_stats[agent_type]["success"] += 1
                except:
                    pass
        
        result = []
        for agent_type, stats in agent_type_stats.items():
            success_rate = (stats["success"] / stats["total"] * 100) if stats["total"] > 0 else 0
            result.append({
                "agent_type": agent_type,
                "success_rate": round(success_rate, 2),
                "total_missions": stats["total"],
                "successful_missions": stats["success"]
            })
        
        return {"success_rates": sorted(result, key=lambda x: x["success_rate"], reverse=True)}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.get("/analytics/execution-times")
async def get_execution_times():
    """Get average execution time by mission category."""
    db = SessionLocal()
    try:
        missions = db.query(Mission).filter(
            and_(Mission.execution_time.isnot(None), Mission.status == "COMPLETED")
        ).all()
        
        category_stats = {}
        for mission in missions:
            category = mission.category or "Uncategorized"
            if category not in category_stats:
                category_stats[category] = {"times": [], "count": 0}
            if mission.execution_time:
                category_stats[category]["times"].append(mission.execution_time)
                category_stats[category]["count"] += 1
        
        result = []
        for category, stats in category_stats.items():
            avg_time = sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0
            result.append({
                "category": category,
                "average_execution_time": round(avg_time, 2),
                "total_missions": stats["count"],
                "min_time": round(min(stats["times"]), 2) if stats["times"] else 0,
                "max_time": round(max(stats["times"]), 2) if stats["times"] else 0
            })
        
        return {"execution_times": sorted(result, key=lambda x: x["average_execution_time"])}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.get("/analytics/cost-trends")
async def get_cost_trends(days: int = 30):
    """Get cost trends and optimization suggestions."""
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        missions = db.query(Mission).filter(
            Mission.created_at >= cutoff_date
        ).order_by(Mission.created_at).all()
        
        daily_costs = {}
        agent_costs = {}
        category_costs = {}
        
        for mission in missions:
            date_str = mission.created_at.strftime("%Y-%m-%d")
            if date_str not in daily_costs:
                daily_costs[date_str] = 0
            daily_costs[date_str] += mission.estimated_cost or 0
            
            if mission.agent_types:
                try:
                    agent_types = json.loads(mission.agent_types) if isinstance(mission.agent_types, str) else mission.agent_types
                    for agent_type in agent_types:
                        if agent_type not in agent_costs:
                            agent_costs[agent_type] = 0
                        agent_costs[agent_type] += (mission.estimated_cost or 0) / len(agent_types)
                except:
                    pass
            
            category = mission.category or "Uncategorized"
            if category not in category_costs:
                category_costs[category] = 0
            category_costs[category] += mission.estimated_cost or 0
        
        # Generate optimization suggestions
        suggestions = []
        if agent_costs:
            top_cost_agent = max(agent_costs.items(), key=lambda x: x[1])
            suggestions.append({
                "type": "agent_optimization",
                "message": f"Agent type '{top_cost_agent[0]}' accounts for ${top_cost_agent[1]:.2f} in costs. Consider optimizing its usage or finding alternatives.",
                "priority": "high" if top_cost_agent[1] > 10 else "medium"
            })
        
        if category_costs:
            top_cost_category = max(category_costs.items(), key=lambda x: x[1])
            suggestions.append({
                "type": "category_optimization",
                "message": f"Category '{top_cost_category[0]}' missions cost ${top_cost_category[1]:.2f}. Review if these missions can be simplified.",
                "priority": "medium"
            })
        
        avg_daily_cost = sum(daily_costs.values()) / len(daily_costs) if daily_costs else 0
        if avg_daily_cost > 5:
            suggestions.append({
                "type": "general",
                "message": f"Average daily cost is ${avg_daily_cost:.2f}. Consider implementing cost budgets or mission prioritization.",
                "priority": "low"
            })
        
        return {
            "daily_costs": [{"date": k, "cost": round(v, 2)} for k, v in sorted(daily_costs.items())],
            "agent_costs": {k: round(v, 2) for k, v in sorted(agent_costs.items(), key=lambda x: x[1], reverse=True)},
            "category_costs": {k: round(v, 2) for k, v in sorted(category_costs.items(), key=lambda x: x[1], reverse=True)},
            "total_cost": round(sum(daily_costs.values()), 2),
            "average_daily_cost": round(avg_daily_cost, 2),
            "suggestions": suggestions
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()

@router.get("/analytics/agent-performance")
async def get_agent_performance():
    """Get agent performance rankings."""
    db = SessionLocal()
    try:
        missions = db.query(Mission).filter(Mission.status.in_(["COMPLETED", "FAILED"])).all()
        
        agent_performance = {}
        for mission in missions:
            if mission.agent_types:
                try:
                    agent_types = json.loads(mission.agent_types) if isinstance(mission.agent_types, str) else mission.agent_types
                    for agent_type in agent_types:
                        if agent_type not in agent_performance:
                            agent_performance[agent_type] = {
                                "total_missions": 0,
                                "successful": 0,
                                "failed": 0,
                                "total_cost": 0.0,
                                "total_time": 0.0,
                                "avg_quality_score": 0.0,
                                "quality_scores": []
                            }
                        
                        agent_performance[agent_type]["total_missions"] += 1
                        if mission.status == "COMPLETED":
                            agent_performance[agent_type]["successful"] += 1
                        else:
                            agent_performance[agent_type]["failed"] += 1
                        
                        agent_performance[agent_type]["total_cost"] += (mission.estimated_cost or 0) / len(agent_types)
                        if mission.execution_time:
                            agent_performance[agent_type]["total_time"] += mission.execution_time / len(agent_types)
                except:
                    pass
        
        result = []
        for agent_type, stats in agent_performance.items():
            success_rate = (stats["successful"] / stats["total_missions"] * 100) if stats["total_missions"] > 0 else 0
            avg_cost = stats["total_cost"] / stats["total_missions"] if stats["total_missions"] > 0 else 0
            avg_time = stats["total_time"] / stats["total_missions"] if stats["total_missions"] > 0 else 0
            
            # Calculate performance score (weighted combination)
            performance_score = (
                success_rate * 0.5 +  # 50% weight on success rate
                (100 - min(avg_cost * 10, 100)) * 0.3 +  # 30% weight on cost efficiency
                (100 - min(avg_time * 2, 100)) * 0.2  # 20% weight on speed
            )
            
            result.append({
                "agent_type": agent_type,
                "performance_score": round(performance_score, 2),
                "success_rate": round(success_rate, 2),
                "total_missions": stats["total_missions"],
                "average_cost": round(avg_cost, 4),
                "average_time": round(avg_time, 2)
            })
        
        return {"rankings": sorted(result, key=lambda x: x["performance_score"], reverse=True)}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        db.close()
