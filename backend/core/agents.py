import os
import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import SerperDevTool, FileReadTool, ScrapeWebsiteTool, YoutubeChannelSearchTool, PDFSearchTool, DirectoryReadTool
from langchain_experimental.tools import PythonREPLTool

from core.socket_handler import WebSocketHandler
from tools.base_tools import CustomYahooFinanceTool, WebHumanInputTool, human_input_store
from tools.rag import KnowledgeBaseTool
from tools.plotting import DataVisualizationTool
from tools.custom_tool_manager import ToolCreatorTool, load_custom_tools

def get_tools(tool_ids: List[str], websocket: WebSocket, human_enabled: bool, file_paths: List[str]) -> List[Any]:
    tools = []
    # Standard
    if "tool-search" in tool_ids: tools.append(SerperDevTool())
    if "tool-scrape" in tool_ids: tools.append(ScrapeWebsiteTool())
    if "tool-youtube" in tool_ids: tools.append(YoutubeChannelSearchTool())
    if "tool-finance" in tool_ids: tools.append(CustomYahooFinanceTool())
    if "tool-python" in tool_ids: tools.append(PythonREPLTool())
    if "tool-rag" in tool_ids: tools.append(KnowledgeBaseTool())
    if "tool-plot" in tool_ids: tools.append(DataVisualizationTool())
    if "tool-builder" in tool_ids: tools.append(ToolCreatorTool())

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

    # Load Custom Tools from DB
    tools.extend(load_custom_tools())

    return tools

def create_agents(agent_data_list: List[dict], uploaded_files: List[str], websocket: WebSocket, mission_id: int) -> Dict[str, Agent]:
    os.environ["OPENAI_API_KEY"] = "NA" # CrewAI fix
    llm = LLM(model="gemini/gemini-2.0-flash", temperature=0.7)

    agents_map = {}
    for a_data in agent_data_list:
        tools = get_tools(a_data['toolIds'], websocket, a_data.get('humanInput'), uploaded_files)

        backstory = a_data['backstory']
        if uploaded_files:
            backstory += f"\n\nNOTICE: You have access to these files: {uploaded_files}. Use your tools to read them if needed."

        agent = Agent(
            role=a_data['role'],
            goal=a_data['goal'],
            backstory=backstory,
            tools=tools,
            llm=llm,
            callbacks=[WebSocketHandler(websocket, mission_id)],
            verbose=True
        )
        agents_map[a_data['id']] = agent

    # QC Agent Injection
    qc_agent = Agent(
        role="Quality Control Engineer",
        goal="Constantly review the codebase for bugs and errors, and thoroughly review all modifications made by other agents.",
        backstory="You are a meticulous Quality Control Engineer. Your responsibility is to ensure the integrity of the codebase. You constantly scan for bugs and errors. Whenever another agent completes a task or modifies files, you shift your attention to review their work precisely. You never self-verify.",
        tools=[DirectoryReadTool(directory='.'), FileReadTool(), PythonREPLTool()],
        llm=llm,
        callbacks=[WebSocketHandler(websocket, mission_id)],
        verbose=True
    )
    agents_map['qc_agent'] = qc_agent

    return agents_map

def create_tasks(plan: List[dict], agents_map: Dict[str, Agent], uploaded_files: List[str]) -> List[Task]:
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
        agent = agents_map.get(step['agentId']) or list(agents_map.values())[0]
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
