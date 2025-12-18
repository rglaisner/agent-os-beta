import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Terminal, 
  Activity, 
  Play, 
  Code, 
  LayoutDashboard,
  Bot,
  Download,
  Sparkles,
  BrainCircuit,
  Paperclip,
  AlertTriangle,
  List,
  Palette,
  Layout,
  Save,
  StopCircle,
  LifeBuoy,
  UserPlus,
  Coins, // Icon for cost
  Zap // Icon for tokens
} from 'lucide-react';

// --- Types & Interfaces ---

interface Agent {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  avatar: string;
  color: string;
  type: 'ADK_SAMPLE' | 'CUSTOM' | 'SUGGESTED' | 'SYSTEM';
}

interface LogEntry {
  id: string;
  timestamp: number;
  agentName: string;
  type: 'THOUGHT' | 'ACTION' | 'OUTPUT' | 'SYSTEM' | 'ERROR' | 'FEEDBACK' | 'RESCUE';
  content: string;
  qualityScore?: number;
}

interface ExecutionStep {
  id: string;
  agentId: string;
  instruction: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'SKIPPED';
  attempts: number;
  isRescueStep?: boolean;
}

interface ExecutionPlan {
  steps: ExecutionStep[];
  explanation: string;
}

interface Artifact {
  id: string;
  timestamp: number;
  type: 'HTML' | 'SVG' | 'CODE';
  title: string;
  content: string;
  agentName: string;
}

interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
}

// --- Agents Data ---

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
    id: 'tool-file-read',
    name: 'File Reader',
    description: 'Read local files (System Tool).',
    pythonClass: 'FileReadTool',
    pythonImport: 'from crewai_tools import FileReadTool'
  }
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'sys-manager',
    name: 'The Boss',
    role: 'Orchestrator',
    goal: 'Plan mission execution and assign tasks to the most suitable agents.',
    backstory: 'You are an expert Project Manager. You break complex goals into atomic steps.',
    avatar: '👔',
    color: 'bg-slate-800',
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
    type: 'ADK_SAMPLE'
  },
  {
    id: 'spec-ui',
    name: 'UI Architect',
    role: 'Frontend Designer',
    goal: 'Create stunning HTML/Tailwind interfaces. Output raw HTML code blocks.',
    backstory: 'You are a pixel-perfect designer. You output code ready to render.',
    avatar: '🎨',
    color: 'bg-pink-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'spec-vector',
    name: 'Vector Artist',
    role: 'SVG Illustrator',
    goal: 'Create inline SVG graphics for logos, icons, and diagrams.',
    backstory: 'You draw with code. You create scalable vector graphics.',
    avatar: '📐',
    color: 'bg-orange-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'adk-writer',
    name: 'Blog Smith',
    role: 'Content Writer',
    goal: 'Write engaging, SEO-optimized blog posts.',
    backstory: 'A creative writer who knows how to hook a reader in the first sentence.',
    avatar: '✍️',
    color: 'bg-purple-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'adk-fomc',
    name: 'Fed Watcher',
    role: 'FOMC Researcher',
    goal: 'Analyze Federal Reserve minutes and economic policy.',
    backstory: 'Specialized in macroeconomics and central bank policy analysis.',
    avatar: '🏦',
    color: 'bg-slate-700',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'adk-data-sci',
    name: 'Data Scientist',
    role: 'Data Scientist',
    goal: 'Extract insights from raw data using ML and statistical analysis.',
    backstory: 'You turn raw numbers into actionable business intelligence.',
    avatar: '🔬',
    color: 'bg-indigo-500',
    type: 'ADK_SAMPLE'
  },
  {
    id: 'adk-fullstack',
    name: 'Dev Guru',
    role: 'Fullstack Engineer',
    goal: 'Write robust, clean code.',
    backstory: 'A master of the full stack.',
    avatar: '💻',
    color: 'bg-blue-600',
    type: 'ADK_SAMPLE'
  }
];

// --- Gemini API Helper (Hardcoded Key) ---



// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'mission', icon: Play, label: 'Mission Control' },
    { id: 'monitor', icon: Activity, label: 'Live Monitor' },
    { id: 'agents', icon: Users, label: 'Agent Lab' },
    { id: 'code', icon: Code, label: 'Export Code' },
  ];

  return (
    <div className="w-16 lg:w-64 bg-slate-950 text-slate-400 flex flex-col h-full border-r border-slate-800 transition-all duration-300 z-20">
      <div className="p-4 flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
          A
        </div>
        <span className="font-bold text-lg text-white hidden lg:block">Agent<span className="text-indigo-400">OS</span></span>
      </div>
      
      <nav className="flex-1 px-2 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                  : 'hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
              <span className="font-medium hidden lg:block text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 px-2 py-2 text-[10px] text-slate-500 font-mono uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="hidden lg:block">System: Ready</span>
        </div>
      </div>
    </div>
  );
};

const AgentLab = ({ agents, setAgents }: { agents: Agent[], setAgents: any }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Partial<Agent>>({});

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agent Library</h1>
             <button 
            onClick={() => { setCurrentAgent({}); setIsEditing(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" /> New Agent
          </button>
        </header>

         {isEditing ? (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-700 animate-in slide-in-from-top-4">
                 <h2 className="mb-4 text-white font-bold">New Agent</h2>
                 <input className="w-full mb-2 p-2 rounded bg-slate-900 border border-slate-700 text-white" placeholder="Name" value={currentAgent.name || ''} onChange={e => setCurrentAgent({...currentAgent, name: e.target.value})} />
                 <input className="w-full mb-2 p-2 rounded bg-slate-900 border border-slate-700 text-white" placeholder="Role" value={currentAgent.role || ''} onChange={e => setCurrentAgent({...currentAgent, role: e.target.value})} />
                 <textarea className="w-full mb-2 p-2 rounded bg-slate-900 border border-slate-700 text-white" placeholder="Goal" value={currentAgent.goal || ''} onChange={e => setCurrentAgent({...currentAgent, goal: e.target.value})} />
                 <div className="flex justify-end gap-2">
                     <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-slate-400 hover:text-white">Cancel</button>
                     <button onClick={() => {
                         const newAgent = { ...currentAgent, id: `custom-${Date.now()}`, type: 'CUSTOM', color: 'bg-indigo-500', avatar: '🤖' } as Agent;
                         const updatedAgents = [...agents, newAgent];
                         setAgents(updatedAgents);
                         setIsEditing(false);
                     }} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500">Save</button>
                 </div>
             </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20 custom-scrollbar">
                {Array.isArray(agents) && agents.map(agent => (
                    <div key={agent.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-colors relative group">
                        <div className="flex justify-between items-start">
                            <span className="text-2xl">{agent.avatar || '🤖'}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded text-slate-300 font-bold uppercase ${agent.type === 'SUGGESTED' ? 'bg-emerald-700' : 'bg-slate-700'}`}>
                                {agent.type}
                            </span>
                        </div>
                        <div className="font-bold mt-2 text-slate-900 dark:text-white">{agent.name}</div>
                        <div className="text-xs text-indigo-500 dark:text-indigo-400">{agent.role}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{agent.goal}</div>
                        {agent.type === 'SUGGESTED' && (
                            <div className="absolute top-2 right-2 text-emerald-500 animate-pulse">
                                <Sparkles className="w-4 h-4"/>
                            </div>
                        )}
                    </div>
                ))}
            </div>
         )}
    </div>
  );
};

const MissionControl = ({ agents, setAgents, onLaunch }: { agents: Agent[], setAgents: any, onLaunch: (plan: ExecutionPlan, context?: string) => void }) => {
  const [goal, setGoal] = useState("Describe anything...");
  const [processType, setProcessType] = useState<'sequential' | 'hierarchical'>('sequential');
  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => setFileContent(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  const generatePlan = async () => {
    setIsPlanning(true);
    const agentList = Array.isArray(agents) ? agents.filter(a => a.type !== 'SYSTEM').map(a => `ID: ${a.id} | Name: ${a.name} | Role: ${a.role}`).join('\n') : '';
    const contextStr = fileContent ? `\nCONTEXT FILE (${fileName}):\n${fileContent.substring(0,1000)}...` : '';

    // Updated Prompt to explicitly request new agents if needed
    const prompt = `
      GOAL: "${goal}"
      ${contextStr}
      
      EXISTING AGENTS:
      ${agentList}
      
      INSTRUCTIONS:
      1. Act as "The Boss" (Manager).
      2. Analyze the goal. If the existing agents are insufficient (e.g., missing specific skills like Legal, Medical, Poetry, etc.), CREATE NEW AGENTS.
      3. Create a linear execution plan.
      4. Assign steps to either existing agents OR the new agents you created.
      
      RETURN STRICT JSON:
      {
        "suggestedNewAgents": [
           { "name": "Agent Name", "role": "Role", "goal": "Goal", "backstory": "Backstory", "avatar": "Emoji" }
        ],
        "steps": [
          { "id": "1", "agentId": "agent_id OR new_agent_name", "instruction": "Task..." }
        ],
        "explanation": "Why this flow?"
      }
    `;

    try {
      const res = await callGemini(prompt, "You are a Project Manager. Return JSON.", true);
      const parsed = JSON.parse(res);
      
      let currentAgents = [...agents];

      // Logic to add new agents
      if (parsed.suggestedNewAgents && parsed.suggestedNewAgents.length > 0) {
          const newAgents = parsed.suggestedNewAgents.map((a: any) => ({
              ...a,
              id: `suggested-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'SUGGESTED',
              color: 'bg-emerald-500'
          }));
          
          currentAgents = [...currentAgents, ...newAgents];
          setAgents(currentAgents); // Update global state
      }

      // Map steps to agent IDs (handling new agents by name matching)
      const initializedSteps = parsed.steps.map((s: any) => {
          const matchedAgent = currentAgents.find(a => a.id === s.agentId || a.name === s.agentId);
          return { 
              ...s, 
              agentId: matchedAgent ? matchedAgent.id : s.agentId, // Ensure ID is used
              status: 'PENDING', 
              attempts: 0 
          };
      });

      setPlan({ ...parsed, steps: initializedSteps });
    } catch (e) {
      console.error(e);
      alert("Planning failed. Try again.");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <header className="mb-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
             <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Orchestration Center</h1>
            <p className="text-slate-500 text-sm">Automated Planning & Supervision.</p>
          </div>
        </header>

        <div className="space-y-6">
          <div className="relative">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="What is your mission?"
            />
            
            <div className="mt-2 flex items-center gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="text-xs flex items-center gap-1 text-slate-500 hover:text-indigo-500 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 transition-colors">
                    <Paperclip className="w-3 h-3" /> {fileName || "Attach Context"}
                </button>
            </div>

            <button
                onClick={generatePlan}
                disabled={isPlanning || !goal}
                className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            >
                {isPlanning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Sparkles className="w-4 h-4" />}
                {isPlanning ? 'Planning...' : 'Generate Plan'}
            </button>
          </div>

          {plan && (
            <div className="animate-in fade-in slide-in-from-top-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-lg mb-6">
                    <p className="text-emerald-700 dark:text-emerald-400 text-sm italic">"{plan.explanation}"</p>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-slate-900 dark:text-white font-bold flex items-center gap-2"><List className="w-4 h-4 text-emerald-500"/> Execution Plan</h3>
                    <span className="text-xs text-slate-500">{plan.steps.length} Steps</span>
                </div>
                
                <div className="space-y-3 mb-6">
                    {plan.steps.map((step, idx) => {
                        const fallbackAgent: Agent = { id: 'unknown', name: 'Unknown', role: 'Worker', goal: '', backstory: '', avatar: '?', color: 'bg-gray-500', type: 'CUSTOM' };
                        const agent = (Array.isArray(agents) && agents.find(a => a.id === step.agentId)) || fallbackAgent;
                        return (
                            <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <div className="text-xs font-mono text-slate-400 w-6">0{idx+1}</div>
                                <div className="text-2xl">{agent.avatar}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{agent.name}</div>
                                        {agent.type === 'SUGGESTED' && <span className="text-[10px] bg-emerald-600 text-white px-1.5 rounded-sm flex items-center gap-1"><UserPlus className="w-3 h-3"/> NEW</span>}
                                    </div>
                                    <div className="text-xs text-slate-500">{step.instruction}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

<div className="mb-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
    <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${processType === 'hierarchical' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
            <BrainCircuit className="w-5 h-5" />
        </div>
        <div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">Process Architecture</div>
            <div className="text-xs text-slate-500">
                {processType === 'sequential' ? 'Linear Execution (Fast)' : 'Manager Delegation (Smart)'}
            </div>
        </div>
    </div>
    <select 
        value={processType}
        onChange={(e) => setProcessType(e.target.value as any)}
        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
    >
        <option value="sequential">Sequential</option>
        <option value="hierarchical">Hierarchical</option>
    </select>
</div>

                <button
                    onClick={() => onLaunch(plan, processType, fileContent || undefined)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 active:scale-[0.99] transition-transform"
                >
                    <Play className="fill-current w-5 h-5" /> Launch Sequence
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LiveMonitor = ({ logs, artifacts, isRunning, onStop }: { logs: LogEntry[], artifacts: Artifact[], isRunning: boolean, onStop: () => void }) => {
  const [activeView, setActiveView] = useState<'LOGS' | 'ARTIFACTS'>('LOGS');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  // If new artifacts arrive, update state but don't force switch to keep user control
  useEffect(() => {
    if (artifacts.length > 0 && isRunning && activeView === 'LOGS') {
        // User notification could be added here
    }
  }, [artifacts.length]);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-300 font-mono text-sm border-l border-slate-800">
      <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900">
        <div className="flex p-1 bg-slate-950 rounded-lg">
            <button 
                onClick={() => setActiveView('LOGS')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeView === 'LOGS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Terminal className="w-3.5 h-3.5" /> Log
            </button>
            <button 
                onClick={() => setActiveView('ARTIFACTS')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeView === 'ARTIFACTS' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Palette className="w-3.5 h-3.5" /> Artifacts
                {artifacts.length > 0 && <span className="bg-white text-indigo-600 px-1 rounded-sm text-[10px]">{artifacts.length}</span>}
            </button>
        </div>
        {isRunning && (
            <button onClick={onStop} className="flex items-center gap-2 text-[10px] text-red-400 hover:text-red-300 bg-red-900/20 px-3 py-1 rounded border border-red-900/50">
                <StopCircle className="w-3 h-3"/> STOP
            </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
          {activeView === 'LOGS' && (
              <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                 {logs.map((log) => (
                    <div key={log.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 ${log.type === 'FEEDBACK' ? 'bg-slate-900/80 p-2 rounded border border-yellow-900/30' : log.type === 'RESCUE' ? 'bg-blue-900/30 p-2 rounded border border-blue-500/50' : log.type === 'ERROR' ? 'bg-red-900/20 p-2 rounded border border-red-900/50' : ''}`}>
                        <div className="w-16 text-[10px] text-slate-600 pt-1 shrink-0">{new Date(log.timestamp).toLocaleTimeString([],{hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                {log.type === 'THOUGHT' && <span className="text-yellow-500 text-[10px]">● THINKING</span>}
                                {log.type === 'ACTION' && <span className="text-blue-500 text-[10px]">● ACTION</span>}
                                {log.type === 'OUTPUT' && <span className="text-emerald-500 text-[10px]">● OUTPUT</span>}
                                {log.type === 'FEEDBACK' && <span className="text-orange-500 text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> SUPERVISOR FEEDBACK</span>}
                                {log.type === 'RESCUE' && <span className="text-blue-400 text-[10px] flex items-center gap-1 font-bold"><LifeBuoy className="w-3 h-3"/> RESCUE INTERVENTION</span>}
                                {log.type === 'ERROR' && <span className="text-red-500 text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> ERROR</span>}
                                <span className="font-bold text-slate-200 text-xs">[{log.agentName}]</span>
                                {log.qualityScore !== undefined && (
                                    <span className={`text-[10px] px-1 rounded ${log.qualityScore >= 70 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                        QS: {log.qualityScore}%
                                    </span>
                                )}
                            </div>
                            <div className="whitespace-pre-wrap text-xs leading-relaxed opacity-90">{log.content}</div>
                        </div>
                    </div>
                 ))}
                 {logs.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50"><Terminal className="w-12 h-12 mb-2"/><p>System Idle</p></div>}
              </div>
          )}
          
          {activeView === 'ARTIFACTS' && (
              <div className="h-full overflow-y-auto bg-slate-900 p-6 space-y-8 custom-scrollbar">
                   {artifacts.length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50">
                           <Layout className="w-12 h-12 mb-2"/>
                           <p>No artifacts generated yet.</p>
                       </div>
                   )}
                   {artifacts.map((art) => (
                       <div key={art.id} className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                           <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                               <div className="flex items-center gap-2">
                                   {art.type === 'HTML' && <Layout className="w-4 h-4 text-pink-400"/>}
                                   {art.type === 'SVG' && <Palette className="w-4 h-4 text-orange-400"/>}
                                   {art.type === 'CODE' && <Code className="w-4 h-4 text-blue-400"/>}
                                   <span className="font-bold text-xs text-white">{art.title}</span>
                               </div>
                               <span className="text-[10px] text-slate-500 uppercase">{art.agentName}</span>
                           </div>
                           <div className="p-4 bg-white/5 min-h-[300px] flex items-center justify-center overflow-auto relative">
                               {art.type === 'HTML' && (
                                   <iframe 
                                     srcDoc={art.content} 
                                     className="w-full h-[400px] bg-white rounded border-0" 
                                     title="Preview"
                                     sandbox="allow-scripts"
                                   />
                               )}
                               {art.type === 'SVG' && (
                                   <div className="p-8 bg-white rounded w-full h-full flex items-center justify-center" dangerouslySetInnerHTML={{ __html: art.content }} />
                               )}
                               {art.type === 'CODE' && (
                                   <pre className="text-xs text-green-400 font-mono p-4 bg-slate-900 rounded w-full overflow-auto max-h-[400px]">{art.content}</pre>
                               )}
                           </div>
                       </div>
                   ))}
              </div>
          )}
      </div>
    </div>
  );
};

const CodeExport = ({ agents }: { agents: Agent[] }) => {
    const generatePythonCode = () => {
      const imports = `import os\nfrom crewai import Agent, Task, Crew, Process\nfrom langchain_google_genai import ChatGoogleGenerativeAI\n\n# --- CONFIGURATION ---\n# Ensure GEMINI_API_KEY is set in your environment variables\nllm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", verbose=True, temperature=0.7)\n\n# --- AGENTS ---\n`;
      const safeAgents = Array.isArray(agents) ? agents.filter(a => a.type !== 'SYSTEM') : [];
      const agentsCode = safeAgents.map(a => {
        const varName = a.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'agent';
        return `# ${a.name} (${a.type})\n${varName} = Agent(\n  role='${a.role?.replace(/'/g, "\\'") || ''}',\n  goal='${a.goal?.replace(/'/g, "\\'") || ''}',\n  backstory='${a.backstory?.replace(/'/g, "\\'") || ''}',\n  verbose=True,\n  allow_delegation=True,\n  llm=llm\n)\n`;
      }).join('\n');
      const firstAgentName = safeAgents[0]?.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '_') || 'agent_1';
      const tasksCode = `\n# --- TASKS ---\ntask1 = Task(\n  description='Execute mission goals.',\n  agent=${firstAgentName},\n  expected_output='Comprehensive output.'\n)\n`;
      const crewCode = `\n# --- CREW ---\ncrew = Crew(\n  agents=[${safeAgents.map(a => a.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'agent').join(', ')}],\n  tasks=[task1],\n  verbose=2,\n  process=Process.sequential\n)\n\n# --- EXECUTION ---\nif __name__ == "__main__":\n    result = crew.kickoff()\n    print(result)`;
      return imports + agentsCode + tasksCode + crewCode;
    };
  
    return (
      <div className="p-8 h-full flex flex-col">
         <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Export to Production</h1>
          <p className="text-slate-500 mt-2">Generate Python code compatible with the CrewAI pip package.</p>
        </header>
        <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-slate-700">
          <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
             <span className="text-slate-400 text-xs font-mono">main.py</span>
             <button 
               onClick={() => {
                  const element = document.createElement("a");
                  const file = new Blob([generatePythonCode()], {type: 'text/plain'});
                  element.href = URL.createObjectURL(file);
                  element.download = "agent_os_crew.py";
                  document.body.appendChild(element); 
                  element.click();
               }}
               className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-2 font-medium transition-colors"
             >
               <Download className="w-3 h-3" /> Download .py
             </button>
          </div>
          <pre className="p-6 text-sm font-mono text-slate-300 overflow-auto flex-1 custom-scrollbar leading-relaxed">
            {generatePythonCode()}
          </pre>
        </div>
      </div>
    );
  };

// --- Main App Logic ---

export default function AgentPlatform() {
  const [activeTab, setActiveTab] = useState('mission');
  const [tools, setTools] = useState<Tool[]>(DEFAULT_TOOLS);
  const [agents, setAgents] = useState<Agent[]>(() => {
      try {
          const saved = localStorage.getItem('agent_os_library');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                  return parsed;
              }
          }
      } catch (e) {
          console.error("Failed to parse agents from local storage", e);
      }
      return DEFAULT_AGENTS;
  });
  
  // Auto-save agents to local storage whenever they change.
  useEffect(() => {
      try {
          localStorage.setItem('agent_os_library', JSON.stringify(agents));
      } catch (e) {
          console.error("Failed to save agents to local storage", e);
      }
  }, [agents]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [usage, setUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const stopSignal = useRef(false);

  const extractArtifacts = (text: string, agentName: string) => {
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const lang = match[1]?.toLowerCase() || 'text';
        const content = match[2];
        if (['html', 'xml'].includes(lang)) {
             setArtifacts(p => [...p, { id: `html-${Date.now()}-${Math.random()}`, timestamp: Date.now(), type: 'HTML', title: 'Web Preview', content, agentName }]);
        } else if (['svg'].includes(lang)) {
             setArtifacts(p => [...p, { id: `svg-${Date.now()}-${Math.random()}`, timestamp: Date.now(), type: 'SVG', title: 'Vector Graphic', content, agentName }]);
        } else if (['jsx', 'tsx', 'js', 'javascript', 'react'].includes(lang)) {
             setArtifacts(p => [...p, { id: `code-${Date.now()}-${Math.random()}`, timestamp: Date.now(), type: 'CODE', title: 'Code Snippet', content, agentName }]);
        }
    }
  };

  const handleStop = () => {
      stopSignal.current = true;
      setLogs(p => [...p, { id: `stop-${Date.now()}`, timestamp: Date.now(), agentName: 'System', type: 'ERROR', content: 'Process Terminated by User.' }]);
      setIsRunning(false);
  };

// --- NEW WEBSOCKET CONNECTOR ---
  const runOrchestratedSimulation = async (
    plan: ExecutionPlan, 
    processType: 'sequential' | 'hierarchical', // <--- NEW PARAM
    context?: string
) => {
    setActiveTab('monitor');
    setIsRunning(true);
    setLogs([]);
    setUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
    
    // 1. Pack the Mission Data
    // We send your Agent definitions and the Plan steps to Python
    const payload = {
    agents: agents.map(a => ({
        // ... (existing agent fields) ...
        id: a.id, 
        name: a.name, 
        role: a.role, 
        goal: a.goal, 
        backstory: a.backstory, 
        toolIds: a.toolIds || [], 
        humanInput: a.humanInput 
    })),
    plan: plan.steps.map(s => ({ 
        id: s.id, 
        agentId: s.agentId, 
        instruction: s.instruction 
    })),
    process: processType,
    
    // --- NEW FIELD ---
    // 'fileContent' is the state variable from the file uploader 
    // that already exists in your MissionControl component
    context: context || "" 
};

    try {
      // 2. Open the Phone Line (WebSocket)
      const ws = new WebSocket('ws://localhost:8000/ws');
      
      ws.onopen = () => {
        // Send the payload immediately
        // FIXED: Wrap payload to match backend expectation
        ws.send(JSON.stringify({ action: "START_MISSION", payload }));
        setLogs(p => [...p, { 
             id: 'sys-connect', 
             timestamp: Date.now(), 
             agentName: 'System', 
             type: 'SYSTEM', 
             content: 'Connected to Python Backend. Transmitting Mission...' 
        }]);
      };

      ws.onmessage = (event) => {
        // 3. Listen for "Thoughts" from Python
        const msg = JSON.parse(event.data);
        
        // Handle explicit error messages
        if (msg.type === 'ERROR') {
             setLogs(p => [...p, { id: `err-${Date.now()}`, timestamp: Date.now(), agentName: 'System', type: 'ERROR', content: msg.content }]);
             return;
        }

        if (msg.type === 'USAGE') {
            setUsage(msg.content);
            return;
        }

        const newLog: LogEntry = {
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            agentName: msg.agentName || 'System',
            type: (msg.type as any) || 'THOUGHT',
            content: msg.content
        };

        setLogs(prev => [...prev, newLog]);

        // Keep the Artifact Detection (Visual Preview) logic
        if (msg.type === 'OUTPUT') {
            extractArtifacts(msg.content, msg.agentName || 'Crew');
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setLogs(p => [...p, { id: 'err', timestamp: Date.now(), agentName: 'System', type: 'ERROR', content: 'Connection Error. Is the Python backend running?' }]);
        setIsRunning(false);
      };

      ws.onclose = () => {
        setLogs(p => [...p, { id: 'sys-close', timestamp: Date.now(), agentName: 'System', type: 'SYSTEM', content: 'Connection Closed.' }]);
        setIsRunning(false);
      };

    } catch (e: any) {
      console.error(e);
      setLogs(p => [...p, { id: 'err-init', timestamp: Date.now(), agentName: 'System', type: 'ERROR', content: `Connection Failed: ${e.message}` }]);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white overflow-hidden selection:bg-indigo-500 selection:text-white">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-hidden">
            {activeTab === 'agents' && <AgentLab agents={agents} setAgents={setAgents} />}
            {activeTab === 'mission' && <MissionControl agents={agents} setAgents={setAgents} onLaunch={runOrchestratedSimulation} />}
            {activeTab === 'monitor' && <LiveMonitor logs={logs} artifacts={artifacts} isRunning={isRunning} onStop={handleStop} />}
            {activeTab === 'code' && <CodeExport agents={agents} />}
        </div>

        {/* Token & Cost Display Footer */}
        {(isRunning || usage.totalCost > 0) && (
            <footer className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-end px-4 gap-4 text-xs font-mono shrink-0 text-slate-400">
                <div className="flex items-center gap-1.5" title="Estimated Input/Output Tokens">
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
      </main>
    </div>
  );
}
