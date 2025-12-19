import os
import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import (
    SerperDevTool, FileReadTool, ScrapeWebsiteTool, YoutubeChannelSearchTool,
    PDFSearchTool, DirectoryReadTool, CSVSearchTool, DOCXSearchTool,
    JSONSearchTool, BraveSearchTool, SerpApiGoogleSearchTool, RagTool
)

from core.socket_handler import WebSocketHandler
from core.config import DEFAULT_MODEL, MANAGER_MODEL, GEMINI_SAFETY_SETTINGS, check_api_key, ensure_openai_key
from tools.base_tools import CustomYahooFinanceTool, WebHumanInputTool, human_input_store, WrapperPythonREPLTool
from tools.rag import KnowledgeBaseTool
from tools.plotting import DataVisualizationTool

# Ensure OpenAI Key is set to avoid validation errors for tools that default to it
ensure_openai_key()

def get_tools(tool_ids: List[str], websocket: WebSocket, human_enabled: bool, file_paths: List[str]) -> List[Any]:
    """
    Instantiate and return a list of tools based on the provided tool IDs.
    """
    tools = []
    # Standard
    if "tool-search" in tool_ids: tools.append(SerperDevTool())
    if "tool-scrape" in tool_ids: tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids: tools.append(YoutubeChannelSearchTool())
    if "tool-finance" in tool_ids: tools.append(CustomYahooFinanceTool())
    if "tool-python" in tool_ids: tools.append(WrapperPythonREPLTool())
    if "tool-rag" in tool_ids: tools.append(KnowledgeBaseTool())
    if "tool-plot" in tool_ids: tools.append(DataVisualizationTool())

    # New Tools with safe initialization
    if "tool-csv" in tool_ids: tools.append(CSVSearchTool())
    if "tool-docx" in tool_ids: tools.append(DOCXSearchTool())
    if "tool-json" in tool_ids: tools.append(JSONSearchTool())

    if "tool-brave" in tool_ids:
        if check_api_key("BRAVE_API_KEY", "BraveSearchTool"):
            tools.append(BraveSearchTool())

    if "tool-serpapi" in tool_ids:
        if check_api_key("SERPAPI_API_KEY", "SerpApiGoogleSearchTool"):
            tools.append(SerpApiGoogleSearchTool())

    if "tool-rag-crew" in tool_ids: tools.append(RagTool())

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
                tools.append(PDFSearchTool(pdf=path))
            else:
                tools.append(FileReadTool(file_path=path))

    return tools

def create_agents(agent_data_list: List[dict], uploaded_files: List[str], websocket: WebSocket, mission_id: int) -> Dict[str, Agent]:
    """
    Create CrewAI Agents based on the provided configuration.
    Injects a Quality Control (QC) Agent into the crew.
    """
    llm = LLM(
        model=DEFAULT_MODEL,
        temperature=0.7,
        timeout=600,  # 10 minutes timeout
        safety_settings=GEMINI_SAFETY_SETTINGS
    )

    agents_map = {}
    for a_data in agent_data_list:
        tools = get_tools(a_data['toolIds'], websocket, a_data.get('humanInput'), uploaded_files)

        backstory = a_data['backstory']
        if uploaded_files:
            backstory += f"\n\nNOTICE: You have access to these files: {uploaded_files}. Use your tools to read them if needed."

        # Configure reasoning and iteration limits
        allow_reasoning = a_data.get('reasoning', False)
        max_iter = a_data.get('max_iter', 25)
        # Mapping max_reasoning_attempts to max_retry_limit as it's the closest analog for "attempts"
        max_retry_limit = a_data.get('max_reasoning_attempts', 2)

        # Standard CrewAI Agent creation
        agent = Agent(
            role=a_data['role'],
            goal=a_data['goal'],
            backstory=backstory,
            tools=tools,
            llm=llm,
            callbacks=[WebSocketHandler(websocket, mission_id)],
            verbose=True,
            max_iter=max_iter,
            max_retry_limit=max_retry_limit,
            allow_delegation=allow_reasoning
        )
        agents_map[a_data['id']] = agent

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
        tools=[DirectoryReadTool(directory='.'), FileReadTool(), WrapperPythonREPLTool()],
        llm=llm,
        callbacks=[WebSocketHandler(websocket, mission_id)],
        verbose=True
    )
    agents_map['qc_agent'] = qc_agent

    return agents_map

def create_tasks(plan: List[dict], agents_map: Dict[str, Agent], uploaded_files: List[str]) -> List[Task]:
    """
    Create CrewAI Tasks based on the mission plan.
    Interleaves QC tasks between agent tasks.
    """
    tasks = []
    qc_agent = agents_map.get('qc_agent')

    # Initial QC Scan
    if qc_agent:
        tasks.append(Task(
            description="Scan the entire codebase using your tools to identify any existing bugs, errors, or architectural issues. Provide a summary of your findings.",
            expected_output="Codebase Health Report",
            agent=qc_agent
        ))

    for step in plan:
        agent_id = step.get('agentId')
        agent = agents_map.get(agent_id)
        if not agent:
            # Fallback and log warning
            agent = list(agents_map.values())[0]
            print(f"Warning: Agent ID '{agent_id}' not found in map. Falling back to '{agent.role}'.")

        desc = step['instruction']
        if uploaded_files:
            desc += f" (Refer to attached files: {uploaded_files})"
        tasks.append(Task(description=desc, expected_output="Report", agent=agent))

        # Interleaved QC Review
        if qc_agent and agent != qc_agent:
            tasks.append(Task(
                description=f"Review the work just completed by {agent.role}. Check for any introduced bugs, errors, or inconsistencies. If files were modified, verify the changes in the context of the entire application.",
                expected_output="Review Report",
                agent=qc_agent
            ))

    return tasks
