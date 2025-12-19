import datetime
import json
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Setup SQLite Database
DATABASE_URL = "sqlite:///./agent_os.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- TABLE DEFINITIONS ---

class Mission(Base):
    __tablename__ = "missions"
    
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    status = Column(String)  # 'RUNNING', 'COMPLETED', 'FAILED'
    goal = Column(Text)
    result = Column(Text, nullable=True)
    total_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    category = Column(String, nullable=True)  # Mission category for analytics
    execution_time = Column(Float, nullable=True)  # Execution time in seconds
    completed_at = Column(DateTime, nullable=True)
    agent_types = Column(Text, nullable=True)  # JSON array of agent types used
    events = relationship("MissionEvent", back_populates="mission")
    communications = relationship("AgentCommunicationLog", back_populates="mission")

class MissionEvent(Base):
    __tablename__ = "mission_events"
    
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"))
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    agent_name = Column(String)
    type = Column(String)
    content = Column(Text)
    mission = relationship("Mission", back_populates="events")

class AgentCommunicationLog(Base):
    __tablename__ = "agent_communications"
    
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    from_agent = Column(String)
    to_agent = Column(String, nullable=True)  # null if broadcast
    message_type = Column(String)  # 'DELEGATION', 'RESPONSE', 'BROADCAST', 'QUERY'
    content = Column(Text)
    metadata = Column(JSON, nullable=True)  # Additional context
    mission = relationship("Mission", back_populates="communications")

class ScheduledMission(Base):
    __tablename__ = "scheduled_missions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    goal = Column(Text)
    plan = Column(JSON)  # Stored plan steps
    agents = Column(JSON)  # Stored agent configs
    schedule_type = Column(String)  # 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'WEBHOOK'
    schedule_config = Column(JSON)  # Cron expression, webhook URL, etc.
    next_run = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    webhook_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CustomTool(Base):
    __tablename__ = "custom_tools"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(Text)
    tool_type = Column(String)  # 'FUNCTION', 'API', 'SCRIPT'
    code = Column(Text)  # Python code or API endpoint
    parameters = Column(JSON)  # Parameter definitions
    test_cases = Column(JSON, nullable=True)  # Test cases
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_tested = Column(DateTime, nullable=True)
    test_results = Column(JSON, nullable=True)

# --- HELPER FUNCTIONS ---

def init_db():
    """Initialize the database tables."""
    Base.metadata.create_all(bind=engine)

def create_mission(goal: str):
    """Create a new mission and return its ID."""
    db = SessionLocal()
    try:
        mission = Mission(goal=goal, status="RUNNING")
        db.add(mission)
        db.commit()
        db.refresh(mission)
        return mission.id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def add_event(mission_id: int, agent_name: str, type: str, content: str):
    """Add a new event to a mission."""
    db = SessionLocal()
    try:
        event = MissionEvent(
            mission_id=mission_id,
            agent_name=agent_name,
            type=type,
            content=content
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def update_mission_result(mission_id: int, result: str, tokens: int = 0, cost: float = 0.0, status: str = "COMPLETED"):
    """Update the result and status of a mission."""
    db = SessionLocal()
    try:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission:
            mission.result = result
            mission.status = status
            mission.total_tokens = tokens
            mission.estimated_cost = cost
            db.commit()
        else:
            raise ValueError(f"Mission with id {mission_id} not found")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_missions(limit: int = 100):
    """Retrieve a list of recent missions."""
    db = SessionLocal()
    try:
        missions = db.query(Mission).order_by(Mission.created_at.desc()).limit(limit).all()
        return missions
    finally:
        db.close()

def get_mission(mission_id: int):
    """Retrieve a single mission by ID."""
    db = SessionLocal()
    try:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        return mission
    finally:
        db.close()

# --- NEW HELPER FUNCTIONS FOR ENHANCED FEATURES ---

def add_communication_log(mission_id: int, from_agent: str, to_agent: str, message_type: str, content: str, metadata: dict = None):
    """Add an agent-to-agent communication log."""
    db = SessionLocal()
    try:
        log = AgentCommunicationLog(
            mission_id=mission_id,
            from_agent=from_agent,
            to_agent=to_agent,
            message_type=message_type,
            content=content,
            metadata=metadata
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_mission_communications(mission_id: int):
    """Get all communications for a mission."""
    db = SessionLocal()
    try:
        logs = db.query(AgentCommunicationLog).filter(AgentCommunicationLog.mission_id == mission_id).order_by(AgentCommunicationLog.timestamp).all()
        return logs
    finally:
        db.close()

def create_scheduled_mission(name: str, goal: str, plan: dict, agents: dict, schedule_type: str, schedule_config: dict, webhook_url: str = None):
    """Create a scheduled mission."""
    db = SessionLocal()
    try:
        scheduled = ScheduledMission(
            name=name,
            goal=goal,
            plan=plan,
            agents=agents,
            schedule_type=schedule_type,
            schedule_config=schedule_config,
            webhook_url=webhook_url
        )
        db.add(scheduled)
        db.commit()
        db.refresh(scheduled)
        return scheduled.id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_scheduled_missions(active_only: bool = False):
    """Get all scheduled missions."""
    db = SessionLocal()
    try:
        query = db.query(ScheduledMission)
        if active_only:
            query = query.filter(ScheduledMission.is_active == True)
        return query.order_by(ScheduledMission.created_at.desc()).all()
    finally:
        db.close()

def create_custom_tool(name: str, description: str, tool_type: str, code: str, parameters: dict, test_cases: list = None):
    """Create a custom tool."""
    db = SessionLocal()
    try:
        tool = CustomTool(
            name=name,
            description=description,
            tool_type=tool_type,
            code=code,
            parameters=parameters,
            test_cases=test_cases
        )
        db.add(tool)
        db.commit()
        db.refresh(tool)
        return tool.id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_custom_tools(active_only: bool = False):
    """Get all custom tools."""
    db = SessionLocal()
    try:
        query = db.query(CustomTool)
        if active_only:
            query = query.filter(CustomTool.is_active == True)
        return query.order_by(CustomTool.created_at.desc()).all()
    finally:
        db.close()

def update_mission_analytics(mission_id: int, category: str = None, execution_time: float = None, agent_types: list = None):
    """Update mission analytics fields."""
    db = SessionLocal()
    try:
        mission = db.query(Mission).filter(Mission.id == mission_id).first()
        if mission:
            if category:
                mission.category = category
            if execution_time is not None:
                mission.execution_time = execution_time
            if agent_types:
                mission.agent_types = json.dumps(agent_types)
            if mission.status == "COMPLETED" and not mission.completed_at:
                mission.completed_at = datetime.datetime.utcnow()
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
