import React, { useState } from 'react';
import { Play, Sparkles, Loader2, FileText, Upload, Paperclip, X, Users, User, Info } from 'lucide-react';

interface Agent {
  id: string;
  role: string;
  toolIds: string[];
}

interface PlanStep {
  id: string;
  agentId: string;
  instruction: string;
}

interface MissionControlProps {
  agents: Agent[];
  onLaunch: (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical') => void;
  isRunning: boolean;
  onAddAgents?: (agents: Agent[]) => void;
}

export default function MissionControl({ agents, onLaunch, isRunning, onAddAgents }: MissionControlProps) {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [planOverview, setPlanOverview] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, path: string}[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processType, setProcessType] = useState<'sequential' | 'hierarchical'>('sequential');
  const [reasoning, setReasoning] = useState<string | null>(null);

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
    setReasoning(null);

    try {
      // Don't send process_type initially, let the backend suggest it
      const response = await fetch(`${backendUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, agents })
      });

      if (!response.ok) throw new Error('Backend failed');
      const data = await response.json();

      if (data.newAgents && data.newAgents.length > 0 && onAddAgents) {
          onAddAgents(data.newAgents);
          // Show a small ephemeral notification? For now we just add them.
      }

      setPlan(data.plan || data); // Fallback for old format
    } catch (err) {
      console.error(err);
      setError("Planning failed. Is the backend running?");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* GOAL */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[120px] resize-y"
            rows={4}
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

      <div className="flex gap-4">
        {/* FILE UPLOAD */}
        <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
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

           <div className="relative group">
               <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               />
               <div className="w-full bg-slate-50 border-2 border-dashed border-slate-300 group-hover:border-indigo-400 group-hover:bg-indigo-50/30 rounded-lg py-6 text-center text-slate-500 text-sm transition-colors">
                   <div className="flex justify-center mb-2"><Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500"/></div>
                   <span className="font-medium text-slate-600 group-hover:text-indigo-600">Click to upload</span> (PDF, Excel, CSV)
               </div>
           </div>
        </div>

        {/* PROCESS TYPE */}
        <div className="w-1/3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
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
      <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider text-sm"><FileText className="w-4 h-4 text-indigo-500" /> Execution Plan</h3>
          {plan.length > 0 && (
            <button
              onClick={() => onLaunch(plan, uploadedFiles.map(f => f.path), processType)}
              disabled={isRunning}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-200 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              LAUNCH MISSION
            </button>
          )}
        </div>

        {reasoning && (
             <div className="mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-sm text-indigo-800 flex gap-2 items-start">
                 <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                 <div>
                     <span className="font-bold">Suggested Strategy:</span> {reasoning}
                 </div>
             </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {plan.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50">Plan will appear here after generation</div>}

            {planOverview && (
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-lg mb-4 text-sm text-slate-700 italic">
                    <span className="font-bold text-indigo-600 not-italic block mb-1">Strategy Overview:</span>
                    {planOverview}
                </div>
            )}

            {plan.map((step, idx) => (
              <div key={idx} className="flex gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 shadow-sm shrink-0 transition-colors">{idx + 1}</div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                    {agents.find(a => a.id === step.agentId)?.role || 'Agent'}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{step.instruction}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
