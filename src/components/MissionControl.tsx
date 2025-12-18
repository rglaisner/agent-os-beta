import React, { useState } from 'react';
import { Play, Sparkles, Loader2, FileText, Upload, Paperclip, X, Users, User } from 'lucide-react';

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
}

export default function MissionControl({ agents, onLaunch, isRunning }: MissionControlProps) {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, path: string}[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processType, setProcessType] = useState<'sequential' | 'hierarchical'>('sequential');

  const backendUrl = import.meta.env.VITE_BACKEND_URL 
    ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('wss://', 'https://')
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

    try {
      const response = await fetch(`${backendUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, agents, process_type: processType })
      });

      if (!response.ok) throw new Error('Backend failed');
      const data = await response.json();
      setPlan(data);
    } catch (err) {
      setError("Planning failed. Is the backend running?");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* GOAL */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
        <label className="block text-sm font-medium text-slate-400 mb-2">Mission Goal</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Analyze the attached CSV and summarize key trends..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 outline-none"
          />
          <button
            onClick={generatePlan}
            disabled={isPlanning || !goal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md flex items-center gap-2 font-medium"
          >
            {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isPlanning ? 'Thinking...' : 'Generate Plan'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      <div className="flex gap-4">
        {/* FILE UPLOAD */}
        <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800">
           <div className="flex justify-between items-center mb-2">
               <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Attachments
               </label>
               {isUploading && <span className="text-xs text-indigo-400 animate-pulse">Uploading...</span>}
           </div>

           <div className="flex flex-wrap gap-2 mb-3">
               {uploadedFiles.map((f, i) => (
                   <div key={i} className="bg-slate-800 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-slate-700">
                       <FileText className="w-3 h-3 text-indigo-400" />
                       {f.name}
                       <button onClick={() => setUploadedFiles(uploadedFiles.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3 hover:text-red-400" />
                       </button>
                   </div>
               ))}
           </div>

           <div className="relative">
               <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
               <div className="w-full bg-slate-900 border border-dashed border-slate-700 rounded-md py-4 text-center text-slate-500 text-xs hover:bg-slate-800 transition-colors">
                   Click to upload (PDF, Excel, CSV)
               </div>
           </div>
        </div>

        {/* PROCESS TYPE */}
        <div className="w-1/3 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col">
            <label className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
               <Users className="w-4 h-4" /> Team Structure
            </label>
            <div className="flex flex-1 gap-2 bg-slate-900 p-1 rounded">
                <button
                    onClick={() => setProcessType('sequential')}
                    className={`flex-1 rounded flex flex-col items-center justify-center gap-1 text-xs transition-colors ${processType === 'sequential' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <User className="w-4 h-4" />
                    Sequential
                </button>
                <button
                    onClick={() => setProcessType('hierarchical')}
                    className={`flex-1 rounded flex flex-col items-center justify-center gap-1 text-xs transition-colors ${processType === 'hierarchical' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Users className="w-4 h-4" />
                    Manager
                </button>
            </div>
        </div>
      </div>

      {/* PLAN */}
      <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-400" /> Plan</h3>
          {plan.length > 0 && (
            <button
              onClick={() => onLaunch(plan, uploadedFiles.map(f => f.path), processType)}
              disabled={isRunning}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              LAUNCH
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
            {plan.map((step, idx) => (
              <div key={idx} className="flex gap-3 bg-slate-900/50 p-3 rounded border border-slate-800/50">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">{idx + 1}</div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                    {agents.find(a => a.id === step.agentId)?.role || 'Agent'}
                  </div>
                  <p className="text-sm text-slate-300">{step.instruction}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
