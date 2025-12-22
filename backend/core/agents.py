import os
import asyncio
from typing import List, Dict, Any, Protocol
from fastapi import WebSocket
from crewai import Agent, Task, Crew, Process, LLM

# Robust import for CrewAI tools across versions:
# - Newer versions have removed or relocated BaseTool
# - We only need BaseTool as a structural/type hint
try:
    from crewai_tools import (
        SerperDevTool,
        FileReadTool,
        ScrapeWebsiteTool,
        YoutubeChannelSearchTool,
        PDFSearchTool,
        DirectoryReadTool,
        CSVSearchTool,
        DOCXSearchTool,
        JSONSearchTool,
        BraveSearchTool,
        SerpApiGoogleSearchTool,
        RagTool,
        BaseTool,
    )
except ImportError:
    # Fallback: import tools without BaseTool and define a lightweight protocol
    from crewai_tools import (
        SerperDevTool,
        FileReadTool,
        ScrapeWebsiteTool,
        YoutubeChannelSearchTool,
        PDFSearchTool,
        DirectoryReadTool,
        CSVSearchTool,
        DOCXSearchTool,
        JSONSearchTool,
        BraveSearchTool,
        SerpApiGoogleSearchTool,
        RagTool,
    )

    class BaseTool(Protocol):
        """Minimal protocol for type-checking tools when BaseTool is unavailable."""

        name: str

        def run(self, *args: Any, **kwargs: Any) -> Any:  # pragma: no cover - shim
            ...


from core.socket_handler import WebSocketHandler
from core.config import (
    DEFAULT_MODEL,
    MANAGER_MODEL,
    GEMINI_SAFETY_SETTINGS,
    check_api_key,
)
from tools.base_tools import (
    CustomYahooFinanceTool,
    WebHumanInputTool,
    human_input_store,
    WrapperPythonREPLTool,
)
from tools.rag import KnowledgeBaseTool
from tools.plotting import DataVisualizationTool
from core.models import AgentModel, PlanStep


def get_tools(
    tool_ids: List[str],
    websocket: WebSocket,
    human_enabled: bool,
    file_paths: List[str],
) -> List[BaseTool]:
    """
    Instantiate and return a list of tools based on the provided tool IDs.
    """
    tools: List[BaseTool] = []

    # Configure Gemini Embedder for tools that use RAG/Embeddings
    # This prevents them from defaulting to OpenAI
    embedder_config = {
        "provider": "google-generativeai",
        "config": {
            "model": "models/embedding-001",
            "api_key": os.getenv("GOOGLE_API_KEY"),
        },
    }

    # Standard
    if "tool-search" in tool_ids:
        tools.append(SerperDevTool())
    if "tool-scrape" in tool_ids:
        tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids:
        tools.append(YoutubeChannelSearchTool())
    if "tool-finance" in tool_ids:
        tools.append(CustomYahooFinanceTool())
    if "tool-python" in tool_ids:
        tools.append(WrapperPythonREPLTool())
    if "tool-rag" in tool_ids:
        tools.append(KnowledgeBaseTool())
    if "tool-plot" in tool_ids:
        tools.append(DataVisualizationTool())

    # New Tools with safe initialization
    if "tool-csv" in tool_ids:
        tools.append(CSVSearchTool(config={"embedder": embedder_config}))
    if "tool-docx" in tool_ids:
        tools.append(DOCXSearchTool(config={"embedder": embedder_config}))
    if "tool-json" in tool_ids:
        tools.append(JSONSearchTool(config={"embedder": embedder_config}))

    if "tool-brave" in tool_ids:
        if check_api_key("BRAVE_API_KEY", "BraveSearchTool"):
            tools.append(BraveSearchTool())

    if "tool-serpapi" in tool_ids:
        if check_api_key("SERPAPI_API_KEY", "SerpApiGoogleSearchTool"):
            tools.append(SerpApiGoogleSearchTool())

    if "tool-rag-crew" in tool_ids:
        tools.append(RagTool(config={"embedder": embedder_config}))

    # Human
    if human_enabled:
        h = WebHumanInputTool()
        h.websocket = websocket
        h.human_input_store = human_input_store
        tools.append(h)

    # File Tools
    if file_paths:
        for path in file_paths:
            if path.endswith(".pdf"):
                tools.append(
                    PDFSearchTool(pdf=path, config={"embedder": embedder_config})
                )
            else:
                tools.append(FileReadTool(file_path=path))

    return tools


def create_agents(
    agent_data_list: List[AgentModel],
    uploaded_files: List[str],
    websocket: WebSocket,
    mission_id: int,
) -> Dict[str, Agent]:
    """
    Create CrewAI Agents based on the provided configuration.
    Injects a Quality Control (QC) Agent into the crew.
    """
    llm = LLM(
        model=DEFAULT_MODEL,
        temperature=0.7,
        timeout=600,  # 10 minutes timeout
        safety_settings=GEMINI_SAFETY_SETTINGS,
    )

    agents_map = {}
    for a_data in agent_data_list:
        # Support both Pydantic AgentModel instances and plain dicts (for tests or legacy callers)
        def _get(field: str, default: Any = None):
            if hasattr(a_data, field):
                return getattr(a_data, field)
            if isinstance(a_data, dict):
                return a_data.get(field, default)
            return default

        tool_ids = _get("toolIds", []) or []
        human_input = bool(_get("humanInput", False))

        tools = get_tools(tool_ids, websocket, human_input, uploaded_files)

        backstory = _get("backstory", "") or ""
        if uploaded_files:
            backstory += f"\n\nNOTICE: You have access to these files: {uploaded_files}. Use your tools to read them if needed."

        # Configure reasoning and iteration limits
        allow_reasoning = bool(_get("reasoning", False))
        max_iter = _get("max_iter", 25) or 25
        # Mapping max_reasoning_attempts to max_retry_limit as it's the closest analog for "attempts"
        max_retry_limit = _get("max_reasoning_attempts", 2) or 2

        # Standard CrewAI Agent creation
        agent = Agent(
            role=_get("role", "Agent"),
            goal=_get("goal", "Complete the assigned tasks"),
            backstory=backstory,
            tools=tools,
            llm=llm,
            callbacks=[WebSocketHandler(websocket, mission_id)],
            verbose=True,
            max_iter=max_iter,
            max_retry_limit=max_retry_limit,
            allow_delegation=allow_reasoning,
        )
        agents_map[_get("id", f"agent-{len(agents_map)+1}")] = agent

    # QC Agent Injection
    qc_backstory = (
        "You are a meticulous Quality Control Engineer. Your responsibility is to ensure the integrity of the codebase. "
        "You constantly scan for bugs and errors. Whenever another agent completes a task or modifies files, you shift your attention to review their work precisely. "
        "You never self-verify. "
        "IMPORTANT: When checking files, ensure you use the correct file path and extension (e.g., 'requirements.txt' not 'requirementstxt'). "
        "Double-check your tool inputs."
    )

    qc_agent = Agent(
        role="Quality Control Engineer",
        goal="Constantly review the codebase for bugs and errors, and thoroughly review all modifications made by other agents.",
        backstory=qc_backstory,
        tools=[
            DirectoryReadTool(directory="."),
            FileReadTool(),
            WrapperPythonREPLTool(),
        ],
        llm=llm,
        callbacks=[WebSocketHandler(websocket, mission_id)],
        verbose=True,
    )
    agents_map["qc_agent"] = qc_agent

    return agents_map


def create_tasks(
    plan: List[PlanStep], agents_map: Dict[str, Agent], uploaded_files: List[str]
) -> List[Task]:
    """
    Create CrewAI Tasks based on the mission plan.
    Interleaves QC tasks between agent tasks.
    """
    tasks = []
    qc_agent = agents_map.get("qc_agent")

    # Initial QC Scan
    if qc_agent:
        tasks.append(
            Task(
                description="Scan the entire codebase using your tools to identify any existing bugs, errors, or architectural issues. Provide a summary of your findings.",
                expected_output="Codebase Health Report",
                agent=qc_agent,
            )
        )

    for step in plan:
        # Support both Pydantic PlanStep instances and plain dicts
        if hasattr(step, "agentId"):
            agent_id = step.agentId
            instruction = step.instruction
        else:
            agent_id = step.get("agentId", "")
            instruction = step.get("instruction", "")
        agent = agents_map.get(agent_id)
        if not agent:
            # Fallback and log warning
            agent = list(agents_map.values())[0]
            print(
                f"Warning: Agent ID '{agent_id}' not found in map. Falling back to '{agent.role}'."
            )

        desc = instruction
        if uploaded_files:
            desc += f" (Refer to attached files: {uploaded_files})"
        tasks.append(Task(description=desc, expected_output="Report", agent=agent))

        # Interleaved QC Review
        if qc_agent and agent != qc_agent:
            tasks.append(
                Task(
                    description=f"Review the work just completed by {agent.role}. Check for any introduced bugs, errors, or inconsistencies. If files were modified, verify the changes in the context of the entire application.",
                    expected_output="Review Report",
                    agent=qc_agent,
                )
            )

    return tasks
