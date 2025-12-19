import React, { useState, useRef, useCallback } from 'react';
import { Bot, Plus, Coins, Zap, Flag } from 'lucide-react';
import LiveMonitor from './components/LiveMonitor';
import AgentCard from './components/AgentCard';
import MissionControl from './components/MissionControl';
import MissionHistory from './components/MissionHistory';
import KnowledgeBase from './components/KnowledgeBase';
import { DEFAULT_AGENTS, DEFAULT_TOOLS, type Agent, type PlanStep } from './constants';

interface LogEntry {
    timestamp: string;
    agentName: string;
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    requestId?: string;
}
interface TokenUsage { inputTokens: number; outputTokens: number; totalCost: number; }

export default function AgentPlatform() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws';
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS.filter(a => a.type !== 'SYSTEM'));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'SETUP' | 'MONITOR' | 'KNOWLEDGE'>('SETUP');
  const [usage, setUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const addAgent = () => {
    setAgents(prev => [...prev, { id: `agent-${Date.now()}`, role: 'New Agent', goal: 'Help', backstory: 'I help.', toolIds: [], humanInput: false, name: 'New Agent', type: 'CUSTOM' }]);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleHumanResponse = (requestId: string, content: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
              action: "HUMAN_RESPONSE",
              requestId,
              content
          }));
          setLogs(p => [...p, {
              timestamp: new Date().toISOString(),
              agentName: 'System',
              type: 'SYSTEM',
              content: `User intervention: ${content.action}`
          }]);
      }
  };

  // Updated to accept files and process type
  const runOrchestratedSimulation = async (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical') => {
    setIsRunning(true);
    setActiveTab('MONITOR');
    setLogs([]);
    setFinalOutput(null); // Reset final output
    setUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 }); // Reset Usage
    
    const connectWebSocket = (): Promise<WebSocket> => {
      return new Promise((resolve, reject) => {
        try {
          const ws = new WebSocket(backendUrl);
          
          ws.onopen = () => {
            ws.send(JSON.stringify({ action: "START_MISSION", payload: { agents, plan, files, processType } }));
            resolve(ws);
          };
          
          ws.onerror = (error) => {
            reject(new Error(`WebSocket connection error: ${error}`));
          };
          
          // Set timeout for connection
          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              ws.close();
              reject(new Error('WebSocket connection timeout'));
            }
          }, 10000); // 10 second timeout
        } catch (e) {
          reject(e);
        }
      });
    };
    
    try {
        const ws = await connectWebSocket();
        wsRef.current = ws;
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'HUMAN_INPUT_REQUEST') {
                    // Use a non-blocking approach - store the request and let InterventionModal handle it
                    // The prompt() call is handled in LiveMonitor via InterventionModal
                    setLogs(prev => [...prev, {
                        timestamp: new Date().toISOString(),
                        agentName: data.agentName || 'System',
                        type: 'HUMAN_INPUT_REQUEST',
                        content: data.content,
                        requestId: data.requestId
                    }]);
                    return;
                }

                if (data.type === 'USAGE') {
                    setUsage(data.content);
                    return;
                }

                if (data.type === 'OUTPUT' && data.agentName === 'System') {
                    setFinalOutput(data.content);
                    // Also log it
                    setLogs(prev => [...prev, { timestamp: new Date().toISOString(), agentName: 'System', type: 'OUTPUT', content: data.content }]);
                    return;
                }

                if (data.type === 'ERROR') {
                    setLogs(prev => [...prev, {
                        timestamp: new Date().toISOString(),
                        agentName: 'System',
                        type: 'ERROR',
                        content: data.content
                    }]);
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
            } catch (parseError) {
                console.error('Failed to parse WebSocket message:', parseError);
                setLogs(prev => [...prev, {
                    timestamp: new Date().toISOString(),
                    agentName: 'System',
                    type: 'ERROR',
                    content: `Failed to parse message: ${parseError}`
                }]);
            }
        };
        
        ws.onclose = (event) => {
            setIsRunning(false);
            if (event.code !== 1000) { // Not a normal closure
                setLogs(prev => [...prev, {
                    timestamp: new Date().toISOString(),
                    agentName: 'System',
                    type: 'ERROR',
                    content: `WebSocket closed unexpectedly (code: ${event.code})`
                }]);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setLogs(prev => [...prev, {
                timestamp: new Date().toISOString(),
                agentName: 'System',
                type: 'ERROR',
                content: 'WebSocket connection error occurred'
            }]);
        };
    } catch (e) {
        console.error('Failed to establish WebSocket connection:', e);
        setLogs(prev => [...prev, {
            timestamp: new Date().toISOString(),
            agentName: 'System',
            type: 'ERROR',
            content: `Failed to connect: ${e instanceof Error ? e.message : String(e)}`
        }]);
        setIsRunning(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
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
          <div className={`w-full lg:w-80 flex flex-col gap-4 overflow-y-auto ${activeTab === 'MONITOR' ? 'hidden lg:flex lg:opacity-50' : ''}`}>
             <div className="flex justify-between items-center px-1">
                 <h2 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Agents</h2>
                 <button onClick={addAgent} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"><Plus className="w-4 h-4" /></button>
             </div>
             {agents.map(a => <AgentCard key={a.id} agent={a} availableTools={DEFAULT_TOOLS} onUpdate={updateAgent} onRemove={removeAgent} />)}
          </div>
        )}
        <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
            <div className={`flex-1 flex flex-col gap-4 h-full overflow-y-auto ${activeTab === 'SETUP' ? 'flex' : 'hidden'}`}>
                <MissionControl agents={agents} onLaunch={runOrchestratedSimulation} isRunning={isRunning} onAddAgents={addNewAgents} onUpdateAgent={updateAgent} />
            </div>
            <div className={`flex-1 flex flex-col gap-4 h-full overflow-hidden ${activeTab === 'MONITOR' ? 'flex' : 'hidden'}`}>
                <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden relative shadow-sm">
                    <LiveMonitor logs={logs as any} isRunning={isRunning} onStop={stopSimulation} onHumanResponse={handleHumanResponse} />
                </div>

                {/* Final Output Box */}
                {finalOutput && (
                    <div className="bg-white rounded-xl border border-emerald-200 shadow-lg shadow-emerald-50 overflow-hidden flex flex-col max-h-[40vh] animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-emerald-50/50 px-4 py-3 border-b border-emerald-100 flex items-center gap-2">
                             <div className="bg-emerald-100 p-1 rounded-md text-emerald-600"><Flag className="w-4 h-4" /></div>
                             <h3 className="font-bold text-emerald-900 text-sm uppercase tracking-wider">Mission Accomplished</h3>
                        </div>
                        <div className="p-6 overflow-y-auto bg-white">
                            <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">{finalOutput}</pre>
                        </div>
                    </div>
                )}

                <div className={`${finalOutput ? 'h-32 opacity-75' : 'h-64'} transition-all duration-500`}><MissionHistory backendUrl={backendUrl} /></div>
            </div>
            <div className={`flex-1 flex flex-col gap-4 h-full overflow-hidden ${activeTab === 'KNOWLEDGE' ? 'flex' : 'hidden'}`}>
                <KnowledgeBase backendUrl={backendUrl} />
            </div>
        </div>
      </main>

      {/* Token & Cost Display Footer */}
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
    </div>
  );
}
