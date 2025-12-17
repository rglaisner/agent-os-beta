import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float
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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
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
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    agent_name = Column(String)
    type = Column(String)
    content = Column(Text)
    mission = relationship("Mission", back_populates="events")

# --- HELPER FUNCTIONS ---

def init_db():
    Base.metadata.create_all(bind=engine)

def create_mission(goal: str):
    db = SessionLocal()
    mission = Mission(goal=goal, status="RUNNING")
    db.add(mission)
    db.commit()
    db.refresh(mission)
    db.close()
    return mission.id

def add_event(mission_id: int, agent_name: str, type: str, content: str):
    db = SessionLocal()
    event = MissionEvent(
        mission_id=mission_id,
        agent_name=agent_name, 
        type=type, 
        content=content
    )
    db.add(event)
    db.commit()
    db.close()

def update_mission_result(mission_id: int, result: str, tokens: int = 0, cost: float = 0.0, status: str = "COMPLETED"):
    db = SessionLocal()
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if mission:
        mission.result = result
        mission.status = status
        mission.total_tokens = tokens
        mission.estimated_cost = cost
        db.commit()
    db.close()