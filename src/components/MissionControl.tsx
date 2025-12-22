import React, { useState, useEffect } from 'react';
import { Agent, PlanStep, PlanResponse } from '../constants';
import { Play, Loader2, RefreshCw, Upload, FileText, X, Paperclip, Users, User, Info, AlertTriangle, Plus, Check } from 'lucide-react';
import Tooltip from './Tooltip';

interface MissionControlProps {
  agents: Agent[];
  allAgents?: Agent[]; // Include SYSTEM agents for validation/planning
  backendUrl?: string; // WebSocket backend URL (will be converted to HTTP for REST calls)
  onLaunch: (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical', goal?: string) => void;
  isRunning: boolean;
  onAddAgents: (agents: Agent[]) => void;
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
  onAgentsChange?: (agents: Agent[]) => void;
  onGoalChange?: (goal: string) => void;
}

export default function MissionControl({ agents, allAgents, backendUrl: propBackendUrl, onLaunch, isRunning, onAddAgents, onUpdateAgent, onGoalChange }: MissionControlProps) {
  // Use allAgents (including SYSTEM) for validation/planning, fallback to agents if not provided
  const agentsForValidation = allAgents || agents;

  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [planOverview, setPlanOverview] = useState<string>(''); // Make editable/settable
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processType, setProcessType] = useState<'sequential' | 'hierarchical'>('sequential');
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, path: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [pendingSuggestedAgents, setPendingSuggestedAgents] = useState<Agent[]>([]);

  // Convert WebSocket URL to HTTP URL for REST API calls
  // IMPORTANT: propBackendUrl comes from App.tsx which already reads VITE_BACKEND_URL
  // If propBackendUrl is MISSING_VITE_BACKEND_URL, it means the env var wasn't available at build time
  const wsBackendUrl = propBackendUrl || (import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws');
  
  // Validate backend URL
  if (!wsBackendUrl || wsBackendUrl === 'MISSING_VITE_BACKEND_URL') {
    console.error('[MissionControl] ERROR: Backend URL is not configured.');
    console.error('[MissionControl] propBackendUrl from App.tsx:', propBackendUrl);
    console.error('[MissionControl] import.meta.env.VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL);
    console.error('[MissionControl] NOTE: Vite env vars must be set BEFORE build. If you just set VITE_BACKEND_URL in Vercel, trigger a new deployment.');
  }
  
  // Don't try to convert if it's the placeholder - it will cause errors
  if (wsBackendUrl === 'MISSING_VITE_BACKEND_URL') {
    console.error('[MissionControl] Cannot make API calls - backend URL is missing');
  }
  
  const backendUrl = wsBackendUrl === 'MISSING_VITE_BACKEND_URL' 
    ? 'MISSING_VITE_BACKEND_URL'
    : wsBackendUrl
        .replace(/^ws:\/\//, 'http://')
        .replace(/^wss:\/\//, 'https://')
        .replace(/\/ws$/, '')
        .replace(/\/$/, ''); // Remove trailing slash if present
    
  console.log('[MissionControl] Backend URL conversion:', { 
    wsBackendUrl, 
    backendUrl, 
    propBackendUrl, 
    envVar: import.meta.env.VITE_BACKEND_URL,
    allViteEnvVars: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setError(null);

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setUploadedFiles([...uploadedFiles, { name: data.filename, path: data.server_path }]);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsUploading(false);
    }
  };

  const generatePlan = async () => {
    if (!goal) return;
    setIsPlanning(true);
    setError(null);
    setIsModified(false);

    try {
      // Include SYSTEM agents (like sys-manager) for plan generation
      const allAgentsForPlanning = agentsForValidation;
      
      // Ensure all agents have required fields for backend (humanInput is required)
      const agentsForBackend = allAgentsForPlanning.map(agent => ({
        id: agent.id,
        role: agent.role,
        goal: agent.goal,
        backstory: agent.backstory,
        toolIds: agent.toolIds || [],
        humanInput: agent.humanInput ?? false, // Default to false if not set
        reasoning: agent.reasoning ?? false,
        max_reasoning_attempts: agent.max_reasoning_attempts,
        max_iter: agent.max_iter,
      }));
      
      const planUrl = `${backendUrl}/api/plan`;
      console.log('[MissionControl] Planning request:', { planUrl, goal, agentCount: agentsForBackend.length });
      
      const response = await fetch(planUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, agents: agentsForBackend, process_type: processType })
      });

      console.log('[MissionControl] Planning response:', { status: response.status, statusText: response.statusText, ok: response.ok });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MissionControl] Planning error response:', errorText);
        throw new Error(`Backend returned ${response.status}: ${errorText.substring(0, 200)}`);
      }
      const data: PlanResponse = await response.json();

      if (data.narrative) {
          setPlanOverview(data.narrative);
      }

      if (data.newAgents && data.newAgents.length > 0) {
          // Filter out existing IDs to avoid duplicates if re-running
          const existingIds = new Set(agents.map(a => a.id));
          const uniqueNewAgents = data.newAgents
              .filter(a => !existingIds.has(a.id))
              .map(a => ({
                  ...a,
                  // Ensure all required fields are present
                  id: a.id || `suggested-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  role: a.role || 'Agent',
                  goal: a.goal || '',
                  backstory: a.backstory || '',
                  toolIds: a.toolIds || [],
                  type: a.type || 'SUGGESTED',
                  name: a.name || a.role,
                  avatar: a.avatar || '🤖',
                  color: a.color || 'bg-emerald-500',
                  humanInput: a.humanInput || false
              }));
          if (uniqueNewAgents.length > 0) {
              // Show suggestion box instead of auto-adding
              setPendingSuggestedAgents(uniqueNewAgents);
          }
      }

      if (data.agentConfigs) {
          Object.entries(data.agentConfigs).forEach(([agentId, config]) => {
              onUpdateAgent(agentId, config as Partial<Agent>);
          });
      }

      setPlan(data.plan);
    } catch (err) {
      console.error('[MissionControl] Planning error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Planning failed: ${errorMessage}. Backend URL: ${backendUrl}/api/plan`);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleStepChange = (idx: number, field: keyof PlanStep, value: string | number) => {
      const newPlan = [...plan];
      newPlan[idx] = { ...newPlan[idx], [field]: value };
      setPlan(newPlan);
      setIsModified(true);
  };

  const handleAddAgent = (agent: Agent) => {
      // Add a single agent from suggestions
      onAddAgents([agent]);
      setPendingSuggestedAgents(prev => prev.filter(a => a.id !== agent.id));
  };

  const handleAddAllAgents = () => {
      onAddAgents(pendingSuggestedAgents);
      setPendingSuggestedAgents([]);
  };

  // Add listener for goal changes to bubble up to parent if needed
  useEffect(() => {
    if (onGoalChange) {
      onGoalChange(goal);
    }
  }, [goal, onGoalChange]);

  const validatePlan = (planToValidate: PlanStep[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (planToValidate.length === 0) {
      errors.push('Plan cannot be empty');
    }
    
    // Create a set of valid IDs for O(1) lookup and debugging
    // Include pending suggested agents in validation to allow launching with suggested agents
    const validAgentIds = new Set([
        ...agentsForValidation.map(a => a.id),
        ...pendingSuggestedAgents.map(a => a.id)
    ]);
    
    console.log('[MissionControl] Validating plan against agents:', Array.from(validAgentIds));
    
    planToValidate.forEach((step, idx) => {
      if (!step.instruction || step.instruction.trim().length === 0) {
        errors.push(`Step ${idx + 1} has no instruction`);
      }
      if (!step.agentId) {
        errors.push(`Step ${idx + 1} has no assigned agent`);
      }
      if (!validAgentIds.has(step.agentId)) {
        console.error(`[MissionControl] Validation failed: Step ${idx + 1} uses ID '${step.agentId}' which is not in validAgentIds`, validAgentIds);
        errors.push(`Step ${idx + 1} references non-existent agent: ${step.agentId}`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  };

  const handleLaunch = () => {
    const validation = validatePlan(plan);
    if (!validation.valid) {
      setError(`Cannot launch: ${validation.errors.join(', ')}`);
      return;
    }
    setError(null);
    onLaunch(plan, uploadedFiles.map(f => f.path), processType);
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* GOAL */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2 w-max group relative cursor-help">
            Mission Goal
            <Info className="w-4 h-4 text-slate-400" />
            <Tooltip text="Describe what you want the agents to accomplish." />
        </label>
        <div className="flex flex-col gap-4">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Analyze the uploaded CSV dataset and summarize the key trends..."
            className="w-full h-24 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-slate-700 placeholder-slate-400 bg-slate-50 font-medium"
          />
          <div className="flex justify-between items-center">
             <div className="text-xs text-slate-400 font-medium flex gap-4">
               {/* Metadata or hints could go here */}
             </div>
             <button
                onClick={generatePlan}
                disabled={!goal || isPlanning || isRunning}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-sm ${
                  !goal || isPlanning || isRunning
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                {isPlanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Planning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate Plan
                  </>
                )}
              </button>
          </div>
        </div>
      </div>

      {/* Suggestion Box for New Agents */}
      {pendingSuggestedAgents.length > 0 && (
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-start mb-3">
                  <div>
                      <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Suggested Agents
                      </h4>
                      <p className="text-xs text-indigo-700 mt-1">
                          The planner suggests adding these agents to complete the mission.
                      </p>
                  </div>
                  <button 
                      onClick={handleAddAllAgents}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
                  >
                      <Plus className="w-3 h-3" /> Accept All
                  </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingSuggestedAgents.map(agent => (
                      <div key={agent.id} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                              <span className="text-xl bg-indigo-100 p-1.5 rounded-md">{agent.avatar || '🤖'}</span>
                              <div>
                                  <div className="font-bold text-slate-800 text-sm">{agent.name}</div>
                                  <div className="text-xs text-slate-500 font-medium">{agent.role}</div>
                              </div>
                          </div>
                          <button 
                              onClick={() => handleAddAgent(agent)}
                              className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"
                              title="Add Agent"
                          >
                              <Plus className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* PLAN & UPLOADS */}
      {/* ... rest of the component ... */}
      
      {/* For brevity, assuming the rest of the component matches the file content */}
      
      {/* We need to render the rest of the component here to make the file complete */}
      <div className="flex-1 min-h-0 flex flex-col gap-4">
        {/* If plan exists, show editor */}
        {plan.length > 0 ? (
           <div className="bg-white flex-1 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h3 className="font-bold text-slate-700 flex items-center gap-2">
                       <FileText className="w-4 h-4 text-slate-400" />
                       Mission Plan
                       <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs border border-slate-200">
                           {plan.length} Steps
                       </span>
                   </h3>
                   {isModified && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Unsaved changes</span>}
               </div>
               
               {/* Narrative / Strategy */}
               {planOverview && (
                   <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm text-slate-600 italic">
                       "{planOverview}"
                   </div>
               )}

               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {plan.map((step, idx) => (
                       <div key={step.id || idx} className="group flex gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                           <div className="flex flex-col items-center gap-1 pt-1">
                               <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200 group-hover:bg-white group-hover:text-indigo-600 group-hover:border-indigo-200 transition-colors">
                                   {idx + 1}
                               </div>
                               {idx < plan.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 group-hover:bg-slate-200/50" />}
                           </div>
                           <div className="flex-1 min-w-0 flex flex-col gap-2">
                               <div className="flex gap-2">
                                   <select
                                      value={step.agentId}
                                      onChange={(e) => handleStepChange(idx, 'agentId', e.target.value)}
                                      className="text-xs font-bold bg-slate-100 border-none rounded-md py-1 pl-2 pr-8 text-slate-700 focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-white hover:shadow-sm transition-all"
                                   >
                                      {/* Show accepted agents */}
                                      {agentsForValidation.map(a => (
                                          <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                                      ))}
                                      {/* Show pending suggested agents too */}
                                      {pendingSuggestedAgents.map(a => (
                                          <option key={a.id} value={a.id}>[New] {a.name} ({a.role})</option>
                                      ))}
                                   </select>
                                   {step.trainingIterations !== undefined && (
                                       <div className="text-xs flex items-center gap-1 text-slate-400 bg-slate-50 px-2 rounded-md border border-slate-100" title="Training Iterations">
                                           <RefreshCw className="w-3 h-3" />
                                           {step.trainingIterations} iter
                                       </div>
                                   )}
                               </div>
                               <textarea
                                  value={step.instruction}
                                  onChange={(e) => handleStepChange(idx, 'instruction', e.target.value)}
                                  className="w-full text-sm bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-300 rounded-md p-2 outline-none resize-none h-auto min-h-[60px] transition-all focus:bg-white focus:shadow-sm"
                                  placeholder="Describe the task step..."
                               />
                           </div>
                           <button 
                              onClick={() => {
                                  const newPlan = plan.filter((_, i) => i !== idx);
                                  setPlan(newPlan);
                                  setIsModified(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded transition-all self-start"
                           >
                               <X className="w-4 h-4" />
                           </button>
                       </div>
                   ))}
                   
                   <button 
                      onClick={() => {
                          const newStep: PlanStep = {
                              id: `step-${Date.now()}`,
                              instruction: '',
                              agentId: agentsForValidation[0]?.id || '',
                              trainingIterations: 0
                          };
                          setPlan([...plan, newStep]);
                          setIsModified(true);
                      }}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/10 transition-all flex items-center justify-center gap-2 group"
                   >
                       <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                       Add Plan Step
                   </button>
               </div>

               <div className="p-4 border-t border-slate-100 bg-slate-50">
                   <button
                      onClick={handleLaunch}
                      disabled={isRunning || plan.length === 0}
                      className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 ${
                        isRunning || plan.length === 0
                          ? 'bg-slate-300 cursor-not-allowed shadow-none'
                          : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-indigo-300'
                      }`}
                   >
                      {isRunning ? (
                          <>
                             <Loader2 className="w-5 h-5 animate-spin" />
                             Mission in Progress...
                          </>
                      ) : (
                          <>
                             <Play className="w-5 h-5 fill-current" />
                             Launch Mission
                          </>
                      )}
                   </button>
                   {error && (
                       <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                           <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                           {error}
                       </div>
                   )}
               </div>
           </div>
        ) : (
            <div className="bg-slate-50 flex-1 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-slate-300" />
                </div>
                <div className="text-center">
                    <h3 className="font-bold text-slate-600">No Plan Generated</h3>
                    <p className="text-sm">Enter a goal and click "Generate Plan" to start.</p>
                </div>
            </div>
        )}
      </div>

      <div className="flex gap-4 shrink-0">
        {/* FILE UPLOAD */}
        <div className="flex-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <div className="flex justify-between items-center mb-4">
               <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                  <Paperclip className="w-4 h-4" /> Attachments
               </label>
               {isUploading && <span className="text-xs text-indigo-600 font-medium animate-pulse">Uploading...</span>}
           </div>

           <div className="flex flex-wrap gap-2 mb-4 min-h-[28px]">
               {uploadedFiles.length === 0 && <span className="text-xs text-slate-400 italic">No files attached</span>}
               {uploadedFiles.map((f, i) => (
                   <div key={i} className="bg-slate-100 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-slate-200 text-slate-700 font-medium">
                       <FileText className="w-3 h-3 text-indigo-500" />
                       {f.name}
                       <button onClick={() => setUploadedFiles(uploadedFiles.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                       </button>
                   </div>
               ))}
           </div>

           <div className="relative group flex-1 min-h-[60px]">
               <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               />
               <div className="w-full h-full bg-slate-50 border-2 border-dashed border-slate-300 group-hover:border-indigo-400 group-hover:bg-indigo-50/30 rounded-lg flex flex-col items-center justify-center text-center text-slate-500 text-sm transition-colors p-2">
                   <div className="flex justify-center mb-1"><Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500"/></div>
                   <span className="font-medium text-slate-600 group-hover:text-indigo-600 text-xs">Click to upload</span>
               </div>
           </div>
        </div>

        {/* PROCESS TYPE */}
        <div className="w-1/3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <label className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wider w-max group relative cursor-help">
               <Users className="w-4 h-4" /> Team Structure
               <Tooltip text="Choose how agents collaborate: linear steps or manager-led delegation." />
            </label>
            <div className="flex flex-1 gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <button
                    onClick={() => setProcessType('sequential')}
                    className={`group relative flex-1 rounded-md flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${processType === 'sequential' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    <User className="w-4 h-4" />
                    Sequential
                    <Tooltip text="Agents execute tasks one by one in a fixed order." />
                </button>
                <button
                    onClick={() => setProcessType('hierarchical')}
                    className={`group relative flex-1 rounded-md flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${processType === 'hierarchical' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    <Users className="w-4 h-4" />
                    Hierarchy
                    <Tooltip text="A Manager Agent oversees others and delegates tasks dynamically." />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}