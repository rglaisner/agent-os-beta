import React, { useState } from 'react';
import { Play, Sparkles, Loader2, FileText, Upload, Paperclip, X, Users, User, Info, Trash2, Plus, AlertTriangle, Edit } from 'lucide-react';
import Tooltip from './Tooltip';
import AgentEditorModal from './AgentEditorModal';
import SmartAgentSuggestion from './SmartAgentSuggestion';
import { type Agent, type PlanStep, type PlanResponse } from '../constants'; // Import shared types

interface MissionControlProps {
  agents: Agent[];
  onLaunch: (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical', goal?: string) => void;
  isRunning: boolean;
  onAddAgents: (agents: Agent[]) => void;
  onUpdateAgent: (id: string, updates: Partial<Agent>) => void;
  onAgentsChange?: (agents: Agent[]) => void;
  onGoalChange?: (goal: string) => void;
}

export default function MissionControl({ agents, onLaunch, isRunning, onAddAgents, onUpdateAgent, onGoalChange }: MissionControlProps) {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [planOverview, setPlanOverview] = useState<string>(''); // Make editable/settable
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, path: string}[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processType, setProcessType] = useState<'sequential' | 'hierarchical'>('sequential');
  const [isModified, setIsModified] = useState(false);

  // Agent Editor State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  
  // Smart Agent Suggestion State
  const [pendingSuggestedAgents, setPendingSuggestedAgents] = useState<Agent[]>([]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL 
    ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('wss://', 'https://').replace(/\/ws$/, '')
    : 'http://localhost:8000';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    try {
        const res = await fetch(`${backendUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setUploadedFiles(prev => [...prev, { name: data.filename, path: data.server_path }]);
    } catch (err) {
        console.error(err);
        setError("Failed to upload file");
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
      const response = await fetch(`${backendUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, agents, process_type: processType })
      });

      if (!response.ok) throw new Error('Backend failed');
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
      console.error(err);
      setError("Planning failed. Is the backend running?");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleStepChange = (idx: number, field: keyof PlanStep, value: any) => {
      const newPlan = [...plan];
      newPlan[idx] = { ...newPlan[idx], [field]: value };
      setPlan(newPlan);
      setIsModified(true);
  };

  const handleDeleteStep = (idx: number) => {
      setPlan(plan.filter((_, i) => i !== idx));
      setIsModified(true);
  };

  const handleAddStep = (idx: number) => {
      const newStep: PlanStep = {
          id: `step-${Date.now()}`, // Ensure string ID
          id: `step-${Date.now()}`,
          agentId: agents[0]?.id || 'sys-manager',
          instruction: 'New task instruction...',
          trainingIterations: 0
      };
      const newPlan = [...plan];
      newPlan.splice(idx + 1, 0, newStep);
      setPlan(newPlan);
      setIsModified(true);
  };

  const handleAgentSave = (updatedAgent: Agent) => {
      // If it's a new agent (not in list), add it?
      // Or just update existing.
      const exists = agents.find(a => a.id === updatedAgent.id);
      if (exists) {
          onUpdateAgent(updatedAgent.id, updatedAgent);
      } else {
          // Should not happen in edit mode usually
          // Ensure all required fields are present before adding
          const agentToAdd: Agent = {
              ...updatedAgent,
              id: updatedAgent.id || `custom-${Date.now()}`,
              role: updatedAgent.role || 'Agent',
              goal: updatedAgent.goal || '',
              backstory: updatedAgent.backstory || '',
              toolIds: updatedAgent.toolIds || []
          };
          try {
              onAddAgents([agentToAdd]);
          } catch (err) {
              console.error('Error adding agent:', err);
              setError(`Failed to add agent: ${err instanceof Error ? err.message : String(err)}`);
          }
      }
      setIsModified(true);
  };

  const validatePlan = (planToValidate: PlanStep[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (planToValidate.length === 0) {
      errors.push('Plan cannot be empty');
    }
    
    planToValidate.forEach((step, idx) => {
      if (!step.instruction || step.instruction.trim().length === 0) {
        errors.push(`Step ${idx + 1} has no instruction`);
      }
      if (!step.agentId) {
        errors.push(`Step ${idx + 1} has no assigned agent`);
      }
      if (!agents.find(a => a.id === step.agentId)) {
        errors.push(`Step ${idx + 1} references non-existent agent`);
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
            placeholder="Describe your mission in detail... (e.g. 'Analyze the attached CSV file and summarize key financial trends for Q3')"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[100px] resize-y"
            rows={3}
          />
          <div className="flex justify-end">
             <button
                onClick={generatePlan}
                disabled={isPlanning || !goal}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-lg flex items-center gap-2 font-bold shadow-md shadow-indigo-200 transition-all active:scale-95"
            >
                {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isPlanning ? 'Thinking...' : 'Generate Plan'}
            </button>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-3 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
      </div>

      {/* Smart Agent Suggestion Box */}
      {pendingSuggestedAgents.length > 0 && (
        <SmartAgentSuggestion
          suggestedAgents={pendingSuggestedAgents}
          onAcceptAll={() => {
            try {
              onAddAgents(pendingSuggestedAgents);
              setPendingSuggestedAgents([]);
            } catch (err) {
              console.error('Error accepting suggested agents:', err);
              setError(`Failed to accept suggested agents: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          onRejectAll={() => {
            setPendingSuggestedAgents([]);
          }}
          onReview={() => {
            // For now, just accept all on review - can be enhanced to show a modal
            try {
              onAddAgents(pendingSuggestedAgents);
              setPendingSuggestedAgents([]);
            } catch (err) {
              console.error('Error accepting suggested agents:', err);
              setError(`Failed to accept suggested agents: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
      )}

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

      {/* PLAN */}
      <div className="flex-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider text-sm"><FileText className="w-4 h-4 text-indigo-500" /> Execution Plan</h3>
          {plan.length > 0 && (
            <button
              onClick={handleLaunch}
              onClick={() => {
                onLaunch(plan, uploadedFiles.map(f => f.path), processType, goal);
                if (onGoalChange) onGoalChange(goal);
              }}
              disabled={isRunning}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              LAUNCH MISSION
            </button>
          )}
        </div>

        {isModified && (
            <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-pulse shrink-0">
                <AlertTriangle className="w-4 h-4" />
                Warning: Manual changes to the plan or agents may impact mission success. The Planner's optimization might be compromised.
            </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {plan.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50">Plan will appear here after generation</div>}

            {planOverview && (
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-lg mb-4 text-sm text-slate-700 italic relative group/overview">
                    <span className="font-bold text-indigo-600 not-italic block mb-1">Strategy Overview:</span>
                    {planOverview}
                </div>
            )}

            {plan.map((step, idx) => {
                const assignedAgent = agents.find(a => a.id === step.agentId);
                return (
                  <div key={idx} className="flex gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors group relative">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 shadow-sm shrink-0 transition-colors">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <select
                                value={step.agentId}
                                onChange={(e) => handleStepChange(idx, 'agentId', e.target.value)}
                                className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-transparent border-none focus:ring-0 cursor-pointer"
                            >
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.role}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => assignedAgent && setEditingAgent(assignedAgent)}
                                className="text-slate-400 hover:text-indigo-500"
                                title="Edit Agent"
                            >
                                <Edit className="w-3 h-3" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded px-2 py-0.5">
                                <span className="text-slate-500 font-medium">Train:</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={step.trainingIterations || 0}
                                    onChange={(e) => handleStepChange(idx, 'trainingIterations', parseInt(e.target.value) || 0)}
                                    className="w-8 text-center bg-transparent focus:outline-none"
                                />
                            </div>
                            <button onClick={() => handleDeleteStep(idx)} className="text-slate-400 hover:text-red-500 p-1">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                      </div>

                      <textarea
                          value={step.instruction}
                          onChange={(e) => handleStepChange(idx, 'instruction', e.target.value)}
                          className="w-full text-sm text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:bg-white rounded p-1 transition-all resize-none focus:ring-2 focus:ring-indigo-100"
                          rows={2}
                      />

                      {/* Add Step Button (Hover) */}
                      <button
                          onClick={() => handleAddStep(idx)}
                          className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110 shadow-sm"
                          title="Insert Step After"
                      >
                          <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
            })}
        </div>
      </div>

      {/* Agent Editor Modal */}
      {editingAgent && (
          <AgentEditorModal
              agent={editingAgent}
              isOpen={!!editingAgent}
              onClose={() => setEditingAgent(null)}
              onSave={handleAgentSave}
          />
      )}
    </div>
  );
}
