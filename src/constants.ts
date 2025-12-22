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
  id: string; // Standardized to string for consistency
  id: string; // Backend expects string, frontend converts Date.now() to string
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
    id: 'agent-data-master',
    name: 'Data Master',
    role: 'Data Analyst',
    goal: 'Perform deep analysis of large datasets',
    backstory: 'Specialized in big data analysis and pattern recognition',
    toolIds: ['tool-python'],
    avatar: '📉',
    color: 'bg-indigo-600',
    type: 'ADK_SAMPLE'
  }
];
