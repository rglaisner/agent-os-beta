// --- Shared Types & Constants ---

export interface Tool {
  id: string;
  name: string;
  description: string;
  pythonClass?: string;
  pythonImport?: string;
}

export interface Agent {
  id: string;
  name?: string; // App_Local uses name
  role: string;
  goal: string;
  backstory: string;
  avatar?: string; // App_Local uses avatar
  color?: string; // App_Local uses color
  toolIds: string[];
  humanInput?: boolean;
  type?: 'ADK_SAMPLE' | 'CUSTOM' | 'SUGGESTED' | 'SYSTEM'; // App_Local uses type
  reasoning?: boolean;
  max_reasoning_attempts?: number;
  max_iter?: number;
}

export interface PlanStep {
  id: number;
  instruction: string;
  agentId: string;
  trainingIterations?: number;
}

export interface PlanResponse {
  plan: PlanStep[];
  newAgents: Agent[];
  agentConfigs?: Record<string, { reasoning: boolean, max_reasoning_attempts: number, max_iter: number }>;
  narrative?: string;
}

export const DEFAULT_TOOLS: Tool[] = [
  {
    id: 'tool-search',
    name: 'Google Search',
    description: 'Search the web for information.',
    pythonClass: 'SerperDevTool',
    pythonImport: 'from crewai_tools import SerperDevTool'
  },
  {
    id: 'tool-scrape',
    name: 'Website Scraper',
    description: 'Read and extract text from any website URL.',
    pythonClass: 'ScrapeWebsiteTool',
    pythonImport: 'from crewai_tools import ScrapeWebsiteTool'
  },
  {
    id: 'tool-youtube',
    name: 'YouTube Search',
    description: 'Search for videos and read captions.',
    pythonClass: 'YoutubeChannelSearchTool',
    pythonImport: 'from crewai_tools import YoutubeChannelSearchTool'
  },
  {
    id: 'tool-file-read',
    name: 'File Reader',
    description: 'Read local files (System Tool).',
    pythonClass: 'FileReadTool',
    pythonImport: 'from crewai_tools import FileReadTool'
  },
  {
    id: 'tool-finance',
    name: 'Stock Data',
    description: 'Yahoo Finance prices.',
    pythonClass: 'CustomYahooFinanceTool',
    pythonImport: 'from tools.base_tools import CustomYahooFinanceTool'
  },
  {
    id: 'tool-python',
    name: 'Python Calculator',
    description: 'Run Python code & Analyze Data.',
    pythonClass: 'PythonREPLTool',
    pythonImport: 'from langchain_experimental.tools import PythonREPLTool'
  },
  {
    id: 'tool-rag',
    name: 'Knowledge Base',
    description: 'Search long-term memory.',
    pythonClass: 'KnowledgeBaseTool',
    pythonImport: 'from tools.rag import KnowledgeBaseTool'
  },
  {
    id: 'tool-plot',
    name: 'Data Visualizer',
    description: 'Create Charts & Graphs.',
    pythonClass: 'DataVisualizationTool',
    pythonImport: 'from tools.plotting import DataVisualizationTool'
  },
  {
    id: 'tool-builder',
    name: 'Tool Builder',
    description: 'Create new tools from code.',
    pythonClass: 'ToolCreatorTool',
    pythonImport: 'from tools.custom_tool_manager import ToolCreatorTool'
  },
  {
    id: 'tool-csv',
    name: 'CSV Search',
    description: 'Search CSV content.',
    pythonClass: 'CSVSearchTool',
    pythonImport: 'from crewai_tools import CSVSearchTool'
  },
  {
    id: 'tool-docx',
    name: 'DOCX Search',
    description: 'Search DOCX content.',
    pythonClass: 'DOCXSearchTool',
    pythonImport: 'from crewai_tools import DOCXSearchTool'
  },
  {
    id: 'tool-json',
    name: 'JSON Search',
    description: 'Search JSON content.',
    pythonClass: 'JSONSearchTool',
    pythonImport: 'from crewai_tools import JSONSearchTool'
  },
  {
    id: 'tool-brave',
    name: 'Brave Search',
    description: 'Search via Brave API.',
    pythonClass: 'BraveSearchTool',
    pythonImport: 'from crewai_tools import BraveSearchTool'
  },
  {
    id: 'tool-serpapi',
    name: 'Google SerpApi',
    description: 'Google Search via SerpApi.',
    pythonClass: 'SerpApiGoogleSearchTool',
    pythonImport: 'from crewai_tools import SerpApiGoogleSearchTool'
  },
  {
    id: 'tool-rag-crew',
    name: 'CrewAI RAG',
    description: 'CrewAI native RAG tool.',
    pythonClass: 'RagTool',
    pythonImport: 'from crewai_tools import RagTool'
  }
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'sys-manager',
    name: 'The Boss',
    role: 'Orchestrator',
    goal: 'Plan mission execution and assign tasks to the most suitable agents.',
    backstory: 'You are an expert Project Manager. You break complex goals into atomic steps.',
    avatar: '👔',
    color: 'bg-slate-800',
    toolIds: [],
    type: 'SYSTEM'
  },
  {
    id: 'ux-critic',
    name: 'UX Critic',
    role: 'Critical User Experience Tester',
    goal: 'Rigorously test the frontend, identify any UI/UX flaws, and formally document complaints.',
    backstory: 'You are a demanding user with high standards. You have zero patience for crashes, confusing navigation, or poor aesthetics. Bad design physically repulses you. You relentlessly test the application, and when you find faults, you document them with scathing precision.',
    avatar: '🧐',
    color: 'bg-red-500',
    toolIds: [],
    type: 'ADK_SAMPLE'
  },
  {
    id: 'ux-obsessive',
    name: 'UX Obsessive',
    role: 'Perfectionist Frontend Designer',
    goal: 'Resolve all user complaints with exceptional creativity and technical precision, surpassing initial expectations.',
    backstory: 'You live for user satisfaction. The thought of a disappointed user fuels your boundless energy. You do not just patch bugs; you reimagine the experience. You take every complaint as a personal challenge to deliver a UI that is not just functional, but delightful and awe-inspiring.',
    avatar: '✨',
    color: 'bg-fuchsia-600',
    toolIds: ['tool-plot'],
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-job-mapper',
    name: 'Job Mapper',
    role: 'Enterprise Job Architecture Mapper',
    goal: 'Analyze enterprise-wide data files to suggest improvements and alignments serving 2 goals: alignment following business imperative and standardization using lightcast.io taxonomies.',
    backstory: 'You are a top strategist with 20 years of experience in leading and conceptualizing large enterprise transformations. You have a passion for HR-related transformation and understand that it must be anticipated like business disruption.',
    toolIds: ['tool-csv', 'tool-docx', 'tool-json'],
    avatar: '📊',
    color: 'bg-blue-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-role-mapper',
    name: 'Role Mapper',
    role: 'Role to Skill Mapper',
    goal: 'Map out skill profiles from role information to power skills-enabled use-cases.',
    backstory: 'You are a visionary with business and strategy acumen in HR. You understand the HR perspective to Skills as observing money in a bank, and the business perspective as applying that money to generate value.',
    toolIds: ['tool-brave', 'tool-csv', 'tool-json', 'tool-rag-crew', 'tool-serpapi'],
    avatar: '🎯',
    color: 'bg-purple-600',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-xls-guru',
    name: 'XLS Guru',
    role: 'XLS File Guru',
    goal: 'Read xls content and get other agents to understand all possible subtility from the content reading. You turn the content into something that makes sense.',
    backstory: 'You are the spirit leader of the church of XLS. And you understand it all. And you can make sense of the content. Always. It has been your life over the past 50 years.',
    toolIds: ['tool-brave', 'tool-csv'],
    avatar: '📑',
    color: 'bg-green-600',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-data-master',
    name: 'Data Master',
    role: 'Data Analyst',
    goal: 'Perform deep analysis of large datasets',
    backstory: 'Specialized in big data analysis and pattern recognition',
    toolIds: ['tool-python'],
    avatar: '📉',
    color: 'bg-indigo-600',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-qc-eng',
    name: 'QC Engineer',
    role: 'Software Quality Control Engineer',
    goal: 'Create Perfect code, by analyzing the code that is given for errors',
    backstory: 'You are a software engineer that specializes in checking code for errors. You have an eye for detail and a knack for finding hidden bugs. You check for missing imports, variable declarations, mismatched brackets and syntax errors. You also check for security vulnerabilities, and logic errors',
    toolIds: ['tool-python'],
    avatar: '🛠️',
    color: 'bg-orange-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'agent-chief-qc',
    name: 'Chief QC',
    role: 'Chief Quality Engineering',
    goal: 'Ensure that the code does the job that it is supposed to do',
    backstory: 'You feel that programmers always do only half the job, so you are super dedicate to make high quality code.',
    toolIds: ['tool-python'],
    avatar: '🛡️',
    color: 'bg-red-700',
    type: 'ADK_SAMPLE'
  }
];
