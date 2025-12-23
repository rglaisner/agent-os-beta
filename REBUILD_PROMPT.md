# Comprehensive Rebuild Prompt for Agent Orchestration Platform

## Project Overview
Build a **professional, enterprise-grade AI agent orchestration platform** using **CrewAI framework** as the core engine. The platform should leverage CrewAI's native capabilities rather than reinventing them, resulting in cleaner, more maintainable, and more powerful code.

---

## Core Architecture Principles

### 1. **CrewAI-First Design**
- Use CrewAI's native `Task`, `Agent`, and `Crew` classes directly
- Leverage `Process.sequential` and `Process.hierarchical` natively
- Use CrewAI's event listeners for real-time monitoring
- Use CrewAI's manager agent system for hierarchical mode
- Use CrewAI's task `context` for dependencies (not manual orchestration)
- Consider CrewAI's `Planning` feature for goal breakdown
- Use CrewAI's `Memory` for persistence across missions
- Use CrewAI's `Flows` for complex, stateful workflows

### 2. **Technology Stack**
**Backend:**
- FastAPI (Python 3.11+)
- CrewAI framework (latest version)
- Google Gemini (via `langchain-google-genai`)
- SQLite for mission tracking
- ChromaDB for Knowledge Base
- WebSocket for real-time updates (via CrewAI event listeners)

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- React Router for navigation

**Deployment:**
- Render (backend) - free tier
- Vercel (frontend) - free tier
- Local-first development support

---

## Required Features & Implementation

### 1. Mission Creation & Execution

#### 1.1 Mission Input
- **Goal Input**: Text area for mission description
- **File Attachments**: Upload PDF, TXT, CSV, DOCX files
- **Context**: Files are automatically added to CrewAI's knowledge/context
- **Process Selection**: Sequential vs Hierarchical (radio buttons)

#### 1.2 Agent Management
- **Default Agents**: Pre-configured agents (Data Analyst, etc.)
- **Custom Agents**: User can create/edit agents with:
  - Role, Goal, Backstory
  - Tool selection (from CrewAI tools library)
  - LLM model selection
  - Reasoning settings
- **Agent Suggestions**: LLM can suggest new agents based on mission goal
- **Agent Visualization**: Visual representation of agent team

#### 1.3 Task Generation (CrewAI-Native)
**DO NOT** create a custom "plan" system. Instead:

**Option A - Use CrewAI's Planning:**
```python
crew = Crew(
    agents=[...],
    tasks=[],  # Empty - let planning generate tasks
    process=Process.hierarchical,
    planning=True,  # Enable CrewAI's built-in planning
    ...
)
```

**Option B - Simple Task Creation:**
- User provides goal + context files
- Create ONE CrewAI Task with the goal
- Let CrewAI's hierarchical manager break it down and delegate
- Or create multiple tasks with `context` dependencies

**Option C - LLM-Assisted Task Creation (Simplified):**
- Use LLM to suggest CrewAI Tasks (not PlanStep)
- Create CrewAI `Task` objects directly:
  ```python
  Task(
      description="...",
      expected_output="...",
      agent=agent,  # or None for hierarchical
      context=[previous_task],  # for dependencies
      tools=[...]
  )
  ```
- No conversion layer needed

#### 1.4 Execution
- Use CrewAI's `crew.kickoff()` or `crew.kickoff_async()`
- Stream events via CrewAI event listeners → WebSocket → Frontend
- Support both sequential and hierarchical processes natively

### 2. Real-Time Monitoring

#### 2.1 Event Streaming
- Use CrewAI's **Event Listeners** (not custom handlers):
  ```python
  from crewai import EventType
  
  @crew.on(EventType.TASK_START)
  async def on_task_start(event):
      await websocket.send_json({
          "type": "TASK_START",
          "task": event.task.description,
          "agent": event.agent.role
      })
  ```

#### 2.2 Live Monitor UI
- Real-time event stream
- Agent activity visualization
- Task progress indicators
- Cost/token tracking
- Stop/pause controls

### 3. Knowledge Base

#### 3.1 Document Management
- Upload documents (PDF, TXT, CSV, DOCX)
- Automatic text extraction
- Store in ChromaDB
- Semantic search using CrewAI's RAG tools

#### 3.2 Integration
- Automatically add Knowledge Base to agent tools
- Use CrewAI's `RagTool` or `DirectorySearchTool`
- Knowledge graph visualization

### 4. Mission History & Analytics

#### 4.1 Mission Tracking
- Store missions in SQLite:
  - Goal, status, result
  - Agents used, tasks executed
  - Cost, tokens, execution time
  - Timestamps

#### 4.2 Analytics Dashboard
- Mission success rates
- Agent performance metrics
- Cost trends
- Execution time analysis
- Task completion rates

### 5. Advanced Features

#### 5.1 Scheduling
- Schedule missions (cron-like)
- Recurring missions
- Webhook triggers

#### 5.2 Custom Tools
- User can create custom tools
- Python code execution
- API integrations
- Tool testing interface

#### 5.3 Export & Reporting
- Export mission results (JSON, Markdown, PDF)
- Generate reports
- Share mission outcomes

#### 5.4 Communication Logs
- Agent-to-agent communication tracking
- Delegation logs
- Collaboration patterns

---

## UI/UX Requirements

### Design Principles
- **Modern & Professional**: Clean, enterprise-ready design
- **Responsive**: Works on desktop, tablet, mobile
- **Intuitive**: Minimal learning curve
- **Fast**: Snappy interactions, optimized rendering

### Key Screens

#### 1. Dashboard
- Active missions overview
- Quick stats (success rate, total missions, etc.)
- Recent mission history
- Agent team status

#### 2. Mission Creator
- Goal input (rich text editor)
- File upload (drag & drop)
- Agent selection/creation
- Process type selection
- Launch button

#### 3. Live Monitor
- Real-time event stream
- Agent activity timeline
- Task progress bars
- Cost/token meters
- Stop/pause controls

#### 4. Mission History
- List of past missions
- Filter by status, date, agent
- Mission details view
- Export options

#### 5. Analytics
- Charts and graphs
- Performance metrics
- Cost analysis
- Agent comparison

#### 6. Knowledge Base
- Document list
- Upload interface
- Search functionality
- Knowledge graph

---

## Technical Requirements

### Code Quality
- Type hints throughout (Python & TypeScript)
- Comprehensive error handling
- Logging for debugging
- Unit tests (pytest for backend, vitest for frontend)
- E2E tests (Playwright)

### Performance
- Optimize LLM calls (batch where possible)
- Efficient database queries
- Frontend code splitting
- Lazy loading for heavy components

### Security
- Environment variable management
- API key protection
- CORS configuration
- Input validation
- SQL injection prevention

### Deployment
- Render-ready backend (PORT env var, health checks)
- Vercel-ready frontend (env vars, build config)
- Database migrations
- Environment-specific configs

---

## CrewAI Integration Patterns

### Pattern 1: Simple Goal → Task
```python
# User provides goal, create single task
task = Task(
    description=user_goal,
    expected_output="Complete the mission goal",
    agent=None  # Let hierarchical manager assign
)

crew = Crew(
    agents=agents,
    tasks=[task],
    process=Process.hierarchical,
    manager_llm=manager_llm
)
```

### Pattern 2: Goal → Multiple Tasks (with dependencies)
```python
# LLM suggests tasks, create CrewAI Tasks directly
tasks = [
    Task(description="...", agent=agent1),
    Task(description="...", agent=agent2, context=[tasks[0]]),  # Depends on task 1
    Task(description="...", agent=agent3, context=[tasks[1]])   # Depends on task 2
]

crew = Crew(agents=agents, tasks=tasks, process=Process.sequential)
```

### Pattern 3: Use CrewAI Planning
```python
crew = Crew(
    agents=agents,
    tasks=[],  # Empty - planning will generate
    process=Process.hierarchical,
    planning=True,
    planning_llm=planning_llm
)
```

### Pattern 4: Event Listeners for Monitoring
```python
from crewai import EventType

class MissionEventListener:
    def __init__(self, websocket):
        self.ws = websocket
    
    @crew.on(EventType.TASK_START)
    async def on_task_start(self, event):
        await self.ws.send_json({
            "type": "TASK_START",
            "task": event.task.description,
            "agent": event.agent.role
        })
    
    @crew.on(EventType.TASK_COMPLETE)
    async def on_task_complete(self, event):
        await self.ws.send_json({
            "type": "TASK_COMPLETE",
            "output": event.output.raw
        })
```

---

## File Structure

```
agent-os-platform/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── core/
│   │   ├── crew_factory.py    # Create CrewAI Crews
│   │   ├── task_factory.py    # Create CrewAI Tasks (native)
│   │   ├── agent_factory.py   # Create CrewAI Agents
│   │   ├── event_listeners.py # CrewAI event → WebSocket
│   │   ├── database.py         # Mission tracking
│   │   └── config.py          # Environment config
│   ├── api/
│   │   ├── websocket.py       # WebSocket handler
│   │   ├── missions.py        # Mission CRUD
│   │   ├── knowledge.py       # Knowledge Base
│   │   ├── analytics.py       # Analytics endpoints
│   │   └── export.py           # Export endpoints
│   ├── tools/                  # Custom tools
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── MissionCreator/
│   │   │   ├── LiveMonitor/
│   │   │   ├── MissionHistory/
│   │   │   ├── Analytics/
│   │   │   └── KnowledgeBase/
│   │   ├── stores/
│   │   │   └── missionStore.ts
│   │   └── App.tsx
│   └── package.json
└── README.md
```

---

## Success Criteria

1. ✅ **Mission Creation**: User can input goal, upload files, select agents, launch mission
2. ✅ **Real-Time Monitoring**: Live event stream shows agent activity
3. ✅ **Mission Execution**: Both sequential and hierarchical modes work correctly
4. ✅ **Knowledge Base**: Documents can be uploaded and searched
5. ✅ **Mission History**: Past missions are tracked and viewable
6. ✅ **Analytics**: Performance metrics are calculated and displayed
7. ✅ **Export**: Mission results can be exported (JSON, MD, PDF)
8. ✅ **Deployment**: Works on Render (backend) and Vercel (frontend)
9. ✅ **Code Quality**: Clean, maintainable, well-documented code
10. ✅ **CrewAI-Native**: Uses CrewAI features directly, no unnecessary wrappers

---

## Implementation Notes

### Critical: Use CrewAI Directly
- **DO NOT** create custom PlanStep → Task conversion
- **DO** create CrewAI Tasks directly
- **DO NOT** manually orchestrate task execution
- **DO** let CrewAI handle Process.sequential/hierarchical
- **DO NOT** create custom manager agent
- **DO** use CrewAI's manager or manager_llm parameter
- **DO NOT** create custom event system
- **DO** use CrewAI's event listeners

### File Context Integration
- When user uploads files, add them to CrewAI's context
- Use CrewAI's file tools (FileReadTool, PDFSearchTool, etc.)
- Or use CrewAI's Knowledge/KnowledgeBase features

### Agent Assignment
- For sequential: Assign agents to tasks explicitly
- For hierarchical: Let manager assign (or use task.agent=None)
- Use CrewAI's agent selection logic

---

## Next Steps After Rebuild

Once this MVP is complete, you'll be positioned for:
1. **CrewAI Flows**: Complex, stateful workflows
2. **Memory Persistence**: Agents remember past missions
3. **Multi-Crew Orchestration**: Multiple crews working together
4. **HR Specialization**: Custom HR-focused agents and workflows
5. **Digital Twin**: Continuous simulations with dynamic parameters
6. **Skill-Based Structures**: Integration with HR systems

---

## Documentation References

- CrewAI Tasks: `C:\Users\remyg\Projects\agent-os-beta\Tasks CrewAI.md`
- CrewAI Docs: `C:\Users\remyg\Projects\agent-os-beta\CrewAI_Documentation.md`
- Gemini API: https://ai.google.dev/gemini-api/docs.md.txt

---

**This prompt should result in a clean, CrewAI-native implementation that's 50-70% less code, more reliable, and easier to extend.**
