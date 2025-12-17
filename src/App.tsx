import React, { useState, useEffect, useRef } from 'react';
import { Bot, Play, SquareTerminal, LayoutDashboard, Settings, Plus, Save, Trash2, StopCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import LiveMonitor from './components/LiveMonitor';
import AgentCard from './components/AgentCard';
import MissionControl from './components/MissionControl';
import MissionHistory from './components/MissionHistory';

// --- TYPES ---
interface Tool {
  id: string;
  name: string;
  description: string;
  pythonClass: string;
  pythonImport: string;
}

interface Agent {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  toolIds: string[];
  humanInput: boolean; 
}

interface LogEntry {
  timestamp: string;
  agentName: string;
  type: 'THOUGHT' | 'ACTION' | 'OUTPUT' | 'SYSTEM' | 'ERROR';
  content: string;
}

interface PlanStep {
  id: string;
  agentId: string;
  instruction: string;
}

// --- DEFAULTS ---
const DEFAULT_TOOLS: Tool[] = [
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
    id: 'tool-finance',
    name: 'Stock Market Data',
    description: 'Get live stock prices and info (Yahoo Finance).',
    pythonClass: 'CustomYahooFinanceTool',
    pythonImport: 'Local Custom Tool'
  },
  {
    id: 'tool-python',
    name: 'Python Calculator',
    description: 'Write and execute Python code to solve math/logic problems.',
    pythonClass: 'PythonREPLTool',
    pythonImport: 'from langchain_experimental.tools import PythonREPLTool'
  },
  {
    id: 'tool-file-read',
    name: 'File Reader',
    description: 'Read local files (System Tool).',
    pythonClass: 'FileReadTool',
    pythonImport: 'from crewai_tools import FileReadTool'
  }
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    role: 'Senior Researcher',
    goal: 'Uncover groundbreaking information',
    backstory: 'You are a curious and persistent researcher.',
    toolIds: ['tool-search', 'tool-scrape'],
    humanInput: false
  },
  {
    id: 'agent-2',
    role: 'Reporting Analyst',
    goal: 'Create detailed reports based on findings',
    backstory: 'You are meticulous and data-driven.',
    toolIds: [],
    humanInput: false
  }
];

export default function AgentPlatform() {
  // --- CONFIGURATION ---
  // The Backend URL is defined here at the top so the whole app can see it
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';

  // --- STATE MANAGEMENT ---
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [tools, setTools] = useState<Tool[]>(DEFAULT_TOOLS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'SETUP' | 'MONITOR'>('SETUP');
  
  const wsRef = useRef<WebSocket | null>(null);

  // --- ACTIONS ---
  const addAgent = () => {
    const newId = `agent-${Date.now()}`;
    setAgents([...agents, {
      id: newId,
      role: 'New Agent',
      goal: 'Do something useful',
      backstory: 'I am a new agent.',
      toolIds: [],
      humanInput: false
    }]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
  };

  const stopSimulation = () => {
    if (wsRef.current) {
        wsRef.current.close();
        setLogs(prev => [...prev, {
            timestamp: new Date().toISOString(),
            agentName: 'System',
            type: 'SYSTEM',
            content: 'Simulation stopped by user.'
        }]);
        setIsRunning(false);
    }
  };

  // --- ORCHESTRATION ---
  const runOrchestratedSimulation = async (plan: PlanStep[], context: string) => {
    setIsRunning(true);
    setActiveTab('MONITOR');
    setLogs([]);

    try {
        const ws = new WebSocket(backendUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: 'System',
                type: 'SYSTEM',
                content: 'Connected to Agent Backend.'
            }]);

            const payload = {
                action: "START_MISSION",
                payload: {
                    agents: agents,
                    plan: plan,
                    context: context
                }
            };
            ws.send(JSON.stringify(payload));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Handle "Ask Human" requests
            if (data.type === 'HUMAN_INPUT_REQUEST') {
                const response = prompt(`Agent asks: ${data.content}`);
                ws.send(JSON.stringify({
                    action: "HUMAN_RESPONSE",
                    requestId: data.requestId,
                    content: response || "No response provided."
                }));
                return;
            }

            // Handle Normal Logs
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: data.agentName || 'System',
                type: data.type,
                content: data.content
            }]);
        };

        ws.onclose = () => {
            setIsRunning(false);
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: 'System',
                type: 'SYSTEM',
                content: 'Connection closed.'
            }]);
        };

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: 'System',
                type: 'ERROR',
                content: 'Connection Error. Is the backend running?'
            }]);
            setIsRunning(false);
        };

    } catch (error) {
        console.error("Simulation failed:", error);
        setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Bot className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">AgentOS <span className="text-slate-600 font-normal text-xs ml-1">v0.2.1</span></h1>
            </div>

            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button 
                    onClick={() => setActiveTab('SETUP')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'SETUP' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <LayoutDashboard className="w-4 h-4" /> Setup
                </button>
                <button 
                    onClick={() => setActiveTab('MONITOR')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'MONITOR' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <SquareTerminal className="w-4 h-4" /> Monitor
                </button>
            </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="container mx-auto p-4 flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]">
        
        {/* LEFT SIDE: AGENT CONFIGURATION */}
        <div className={`w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto transition-opacity ${activeTab === 'MONITOR' && 'hidden lg:flex lg:opacity-50 hover:opacity-100'}`}>
           <div className="flex items-center justify-between sticky top-0 bg-slate-950 py-2 z-10">
                <h2 className="font-bold text-slate-400 text-sm uppercase tracking-wider">Active Agents ({agents.length})</h2>
                <button onClick={addAgent} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors">
                    <Plus className="w-4 h-4" />
                </button>
           </div>
           
           <div className="flex flex-col gap-3 pb-20">
                {agents.map((agent) => (
                    <AgentCard 
                        key={agent.id} 
                        agent={agent} 
                        availableTools={tools}
                        onUpdate={(updates) => updateAgent(agent.id, updates)}
                        onRemove={() => removeAgent(agent.id)}
                    />
                ))}
           </div>
        </div>

        {/* RIGHT SIDE: MONITOR & HISTORY */}
        <div className="flex-1 flex flex-col gap-4 h-full">
            
            {activeTab === 'SETUP' ? (
                <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl p-6 overflow-y-auto">
                     <MissionControl 
                        agents={agents} 
                        onLaunch={runOrchestratedSimulation}
                        isRunning={isRunning}
                     />
                </div>
            ) : (
                <>
                    {/* TOP: LIVE LOGS */}
                    <div className="flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
                        <LiveMonitor logs={logs} isRunning={isRunning} onStop={stopSimulation} />
                    </div>

                    {/* BOTTOM: HISTORY */}
                    <div className="h-64 mt-4"> 
                       <MissionHistory backendUrl={backendUrl} />
                    </div>
                </>
            )}

        </div>

      </main>
    </div>
  );
}