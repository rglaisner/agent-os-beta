import React, { useState, useRef } from 'react';
import { Bot, SquareTerminal, LayoutDashboard, Plus } from 'lucide-react';
import LiveMonitor from './components/LiveMonitor';
import AgentCard from './components/AgentCard';
import MissionControl from './components/MissionControl';
import MissionHistory from './components/MissionHistory';

// --- TYPES ---
interface Tool {
  id: string;
  name: string;
  description: string;
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
  { id: 'tool-search', name: 'Google Search', description: 'Search the web.' },
  { id: 'tool-scrape', name: 'Website Scraper', description: 'Read website content.' },
  { id: 'tool-finance', name: 'Stock Data', description: 'Yahoo Finance prices.' },
  { id: 'tool-python', name: 'Python Calculator', description: 'Run Python code.' },
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    role: 'Researcher',
    goal: 'Find information',
    backstory: 'Expert researcher.',
    toolIds: ['tool-search'],
    humanInput: false
  }
];

export default function AgentPlatform() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';

  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'SETUP' | 'MONITOR'>('SETUP');
  
  const wsRef = useRef<WebSocket | null>(null);

  const addAgent = () => {
    const newId = `agent-${Date.now()}`;
    setAgents([...agents, { id: newId, role: 'New Agent', goal: 'Help', backstory: 'I help.', toolIds: [], humanInput: false }]);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
  };

  const stopSimulation = () => {
    if (wsRef.current) wsRef.current.close();
    setIsRunning(false);
  };

  const runOrchestratedSimulation = async (plan: PlanStep[], context: string) => {
    setIsRunning(true);
    setActiveTab('MONITOR');
    setLogs([]);

    try {
        const ws = new WebSocket(backendUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            const payload = {
                action: "START_MISSION",
                payload: { agents, plan, context }
            };
            ws.send(JSON.stringify(payload));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'HUMAN_INPUT_REQUEST') {
                const response = prompt(`Agent asks: ${data.content}`);
                ws.send(JSON.stringify({ action: "HUMAN_RESPONSE", requestId: data.requestId, content: response || "None" }));
                return;
            }
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: data.agentName || 'System',
                type: data.type,
                content: data.content
            }]);
        };

        ws.onclose = () => setIsRunning(false);
    } catch (e) {
        console.error(e);
        setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="h-16 border-b border-slate-800 bg-slate-950/50 flex items-center px-4 justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-indigo-500" />
            <h1 className="font-bold">AgentOS v0.3</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setActiveTab('SETUP')} className={`px-3 py-1 rounded text-sm ${activeTab === 'SETUP' ? 'bg-indigo-600' : 'text-slate-400'}`}>Setup</button>
            <button onClick={() => setActiveTab('MONITOR')} className={`px-3 py-1 rounded text-sm ${activeTab === 'MONITOR' ? 'bg-indigo-600' : 'text-slate-400'}`}>Monitor</button>
        </div>
      </header>

      <main className="container mx-auto p-4 flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]">
        {/* LEFT: CONFIG */}
        <div className={`w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto ${activeTab === 'MONITOR' ? 'hidden lg:flex lg:opacity-50' : ''}`}>
           <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-400 text-xs uppercase">Agents</h2>
                <button onClick={addAgent}><Plus className="w-4 h-4" /></button>
           </div>
           {agents.map(a => (
             <AgentCard key={a.id} agent={a} availableTools={DEFAULT_TOOLS} onUpdate={(u) => updateAgent(a.id, u)} onRemove={() => removeAgent(a.id)} />
           ))}
        </div>

        {/* RIGHT: ACTION */}
        <div className="flex-1 flex flex-col gap-4 h-full">
            {activeTab === 'SETUP' ? (
                <MissionControl agents={agents} onLaunch={runOrchestratedSimulation} isRunning={isRunning} />
            ) : (
                <>
                    <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative">
                        <LiveMonitor logs={logs} isRunning={isRunning} onStop={stopSimulation} />
                    </div>
                    <div className="h-64"><MissionHistory backendUrl={backendUrl} /></div>
                </>
            )}
        </div>
      </main>
    </div>
  );
}