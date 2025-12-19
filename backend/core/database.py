import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

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
    events = relationship("MissionEvent", back_populates="mission")

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
    __tablename__ = "agent_communication_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    agent_name = Column(String)
    message_type = Column(String)
    content = Column(Text)
    log_metadata = Column(Text, nullable=True)  # Renamed from 'metadata' to avoid SQLAlchemy conflict

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
