import React, { useState, useRef, useCallback } from 'react';
import { Bot, Plus, Coins, Zap } from 'lucide-react';
import LiveMonitor from './components/LiveMonitor';
import AgentCard from './components/AgentCard';
import MissionControl from './components/MissionControl';
import MissionHistory from './components/MissionHistory';
import KnowledgeBase from './components/KnowledgeBase';

// --- TYPES ---
interface Tool { id: string; name: string; description: string; }
interface Agent {
    id: string;
    role: string;
    goal: string;
    backstory: string;
    toolIds: string[];
    humanInput: boolean;
    max_rpm?: number;
    memory?: boolean;
}
interface LogEntry { timestamp: string; agentName: string; type: string; content: string; }
interface PlanStep { id: string; agentId: string; instruction: string; }
interface TokenUsage { inputTokens: number; outputTokens: number; totalCost: number; }

// --- RESTORED DEFAULTS ---
const DEFAULT_TOOLS: Tool[] = [
  { id: 'tool-search', name: 'Google Search', description: 'Search the web.' },
  { id: 'tool-scrape', name: 'Website Scraper', description: 'Read website content.' },
  { id: 'tool-finance', name: 'Stock Data', description: 'Yahoo Finance prices.' },
  { id: 'tool-python', name: 'Python Calculator', description: 'Run Python code & Analyze Data.' },
  { id: 'tool-rag', name: 'Knowledge Base', description: 'Search long-term memory.' },
  { id: 'tool-plot', name: 'Data Visualizer', description: 'Create Charts & Graphs.' },
  { id: 'tool-builder', name: 'Tool Builder', description: 'Create new tools from code.' },
  { id: 'tool-csv', name: 'CSV Search', description: 'Search CSV content.' },
  { id: 'tool-docx', name: 'DOCX Search', description: 'Search DOCX content.' },
  { id: 'tool-json', name: 'JSON Search', description: 'Search JSON content.' },
  { id: 'tool-brave', name: 'Brave Search', description: 'Search via Brave API.' },
  { id: 'tool-serpapi', name: 'Google SerpApi', description: 'Google Search via SerpApi.' },
  { id: 'tool-rag-crew', name: 'CrewAI RAG', description: 'CrewAI native RAG tool.' },
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'ux-critic',
    role: 'Critical User Experience Tester',
    goal: 'Rigorously test the frontend, identify any UI/UX flaws, and formally document complaints.',
    backstory: 'You are a demanding user with high standards. You have zero patience for crashes, confusing navigation, or poor aesthetics. Bad design physically repulses you. You relentlessly test the application, and when you find faults, you document them with scathing precision.',
    toolIds: [],
    humanInput: false
  },
  {
    id: 'ux-obsessive',
    role: 'Perfectionist Frontend Designer',
    goal: 'Resolve all user complaints with exceptional creativity and technical precision, surpassing initial expectations.',
    backstory: 'You live for user satisfaction. The thought of a disappointed user fuels your boundless energy. You do not just patch bugs; you reimagine the experience. You take every complaint as a personal challenge to deliver a UI that is not just functional, but delightful and awe-inspiring.',
    toolIds: ['tool-plot'],
    humanInput: false
  },
  {
    id: 'agent-job-mapper',
    role: 'Enterprise Job Architecture Mapper',
    goal: 'Analyze enterprise-wide data files to suggest improvements and alignments serving 2 goals: alignment following business imperative and standardization using lightcast.io taxonomies.',
    backstory: 'You are a top strategist with 20 years of experience in leading and conceptualizing large enterprise transformations. You have a passion for HR-related transformation and understand that it must be anticipated like business disruption.',
    toolIds: ['tool-csv', 'tool-docx', 'tool-json'],
    humanInput: false
  },
  {
    id: 'agent-role-mapper',
    role: 'Role to Skill Mapper',
    goal: 'Map out skill profiles from role information to power skills-enabled use-cases.',
    backstory: 'You are a visionary with business and strategy acumen in HR. You understand the HR perspective to Skills as observing money in a bank, and the business perspective as applying that money to generate value.',
    toolIds: ['tool-brave', 'tool-csv', 'tool-json', 'tool-rag-crew', 'tool-serpapi'],
    humanInput: false
  },
  {
    id: 'agent-xls-guru',
    role: 'XLS File Guru',
    goal: 'Read xls content and get other agents to understand all possible subtility from the content reading. You turn the content into something that makes sense.',
    backstory: 'You are the spirit leader of the church of XLS. And you understand it all. And you can make sense of the content. Always. It has been your life over the past 50 years.',
    toolIds: ['tool-brave', 'tool-csv'],
    humanInput: false
  },
  {
    id: 'agent-data-master',
    role: 'Data Analyst',
    goal: 'Perform deep analysis of large datasets',
    backstory: 'Specialized in big data analysis and pattern recognition',
    toolIds: ['tool-python'],
    humanInput: false,
    max_rpm: 10,
    memory: true
  },
  {
    id: 'agent-qc-eng',
    role: 'Software Quality Control Engineer',
    goal: 'Create Perfect code, by analyzing the code that is given for errors',
    backstory: 'You are a software engineer that specializes in checking code for errors. You have an eye for detail and a knack for finding hidden bugs. You check for missing imports, variable declarations, mismatched brackets and syntax errors. You also check for security vulnerabilities, and logic errors',
    toolIds: ['tool-python'],
    humanInput: false
  },
  {
    id: 'agent-chief-qc',
    role: 'Chief Quality Engineering',
    goal: 'Ensure that the code does the job that it is supposed to do',
    backstory: 'You feel that programmers always do only half the job, so you are super dedicate to make high quality code.',
    toolIds: ['tool-python'],
    humanInput: false
  }
];

export default function AgentPlatform() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'SETUP' | 'MONITOR' | 'KNOWLEDGE'>('SETUP');
  const [usage, setUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  const addAgent = () => {
    setAgents(prev => [...prev, { id: `agent-${Date.now()}`, role: 'New Agent', goal: 'Help', backstory: 'I help.', toolIds: [], humanInput: false }]);
  };

  const addNewAgents = useCallback((newAgents: Agent[]) => {
      setAgents(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const uniqueNewAgents = newAgents.filter(a => !existingIds.has(a.id));
          return [...prev, ...uniqueNewAgents];
      });
  }, []);

  const updateAgent = useCallback((id: string, u: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...u } : a));
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  const stopSimulation = () => { if (wsRef.current) wsRef.current.close(); setIsRunning(false); };

  // Updated to accept files and process type
  const runOrchestratedSimulation = async (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical') => {
    setIsRunning(true);
    setActiveTab('MONITOR');
    setLogs([]);
    setUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 }); // Reset Usage
    try {
        const ws = new WebSocket(backendUrl);
        wsRef.current = ws;
        ws.onopen = () => {
            ws.send(JSON.stringify({ action: "START_MISSION", payload: { agents, plan, files, processType } }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'HUMAN_INPUT_REQUEST') {
                const response = prompt(`Agent asks: ${data.content}`);
                ws.send(JSON.stringify({ action: "HUMAN_RESPONSE", requestId: data.requestId, content: response || "None" }));
                return;
            }

            if (data.type === 'USAGE') {
                setUsage(data.content);
                return;
            }

            setLogs(prev => {
                // Streaming Logic: If STREAM, append to last log if it's also STREAM/THOUGHT from same agent
                if (data.type === 'STREAM') {
                    const last = prev[prev.length - 1];
                    if (last && (last.type === 'THOUGHT' || last.type === 'STREAM') && last.agentName === data.agentName) {
                        return [
                            ...prev.slice(0, -1),
                            { ...last, content: last.content + data.content, type: 'THOUGHT' } // Keep type as THOUGHT for display
                        ];
                    }
                    // Start new stream
                    return [...prev, { timestamp: new Date().toISOString(), agentName: data.agentName || 'System', type: 'THOUGHT', content: data.content }];
                }
                return [...prev, { timestamp: new Date().toISOString(), agentName: data.agentName || 'System', type: data.type, content: data.content }];
            });
        };
        ws.onclose = () => setIsRunning(false);
    } catch (e) { console.error(e); setIsRunning(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      <header className="h-16 border-b border-slate-800 bg-slate-950/50 flex items-center px-4 justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Bot className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">AgentOS <span className="text-xs font-normal text-slate-500 ml-1">v0.5</span></h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setActiveTab('SETUP')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'SETUP' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Setup</button>
            <button onClick={() => setActiveTab('MONITOR')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'MONITOR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monitor</button>
            <button onClick={() => setActiveTab('KNOWLEDGE')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'KNOWLEDGE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Knowledge</button>
        </div>
      </header>
      <main className="container mx-auto p-4 flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {activeTab !== 'KNOWLEDGE' && (
          <div className={`w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto ${activeTab === 'MONITOR' ? 'hidden lg:flex lg:opacity-50' : ''}`}>
             <div className="flex justify-between items-center px-1">
                 <h2 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Agents</h2>
                 <button onClick={addAgent} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"><Plus className="w-4 h-4" /></button>
             </div>
             {agents.map(a => <AgentCard key={a.id} agent={a} availableTools={DEFAULT_TOOLS} onUpdate={updateAgent} onRemove={removeAgent} />)}
          </div>
        )}
        <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
            {activeTab === 'SETUP' && <MissionControl agents={agents} onLaunch={runOrchestratedSimulation} isRunning={isRunning} onAddAgents={addNewAgents} />}
            {activeTab === 'MONITOR' && (
                <>
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden relative shadow-sm"><LiveMonitor logs={logs} isRunning={isRunning} onStop={stopSimulation} /></div>
                    <div className="h-64"><MissionHistory backendUrl={backendUrl} /></div>
                </>
            )}
            {activeTab === 'KNOWLEDGE' && <KnowledgeBase backendUrl={backendUrl} />}
        </div>
      </main>

      {/* Token & Cost Display Footer */}
      {(isRunning || usage.totalCost > 0) && (
        <footer className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-end px-4 gap-4 text-xs font-mono shrink-0">
             <div className="flex items-center gap-1.5 text-slate-400" title="Estimated Input/Output Tokens">
                 <Zap className="w-3 h-3 text-yellow-500" />
                 <span>IN: {usage.inputTokens.toLocaleString()}</span>
                 <span className="text-slate-600">|</span>
                 <span>OUT: {usage.outputTokens.toLocaleString()}</span>
             </div>
             <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-900/20 px-2 py-0.5 rounded">
                 <Coins className="w-3 h-3" />
                 <span>${usage.totalCost.toFixed(5)}</span>
             </div>
        </footer>
      )}
    </div>
  );
}
