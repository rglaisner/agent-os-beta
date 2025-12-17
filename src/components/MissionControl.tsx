import React, { useState } from 'react';
import { Play, Sparkles, Loader2, FileText, Upload } from 'lucide-react';

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
  onLaunch: (plan: PlanStep[], context: string) => void;
  isRunning: boolean;
}

export default function MissionControl({ agents, onLaunch, isRunning }: MissionControlProps) {
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Backend URL from Env
  const backendUrl = import.meta.env.VITE_BACKEND_URL 
    ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('wss://', 'https://')
    : 'http://localhost:8000';

  const generatePlan = async () => {
    if (!goal) return;
    setIsPlanning(true);
    setError(null);

    try {
      // CALL THE BACKEND API
      const response = await fetch(`${backendUrl}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, agents })
      });

      if (!response.ok) throw new Error('Backend failed to generate plan');

      const data = await response.json();
      setPlan(data);
    } catch (err) {
      console.error(err);
      setError("Planning failed. Check Backend Logs.");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* GOAL INPUT */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
        <label className="block text-sm font-medium text-slate-400 mb-2">Mission Goal</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Analyze the stock performance of Apple vs Microsoft..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={generatePlan}
            disabled={isPlanning || !goal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md flex items-center gap-2 font-medium transition-colors"
          >
            {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isPlanning ? 'Thinking...' : 'Generate Plan'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {/* CONTEXT UPLOAD */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
         <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Context Data (Optional)
         </label>
         <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste text, CSV data, or JSON here for the agents to read..."
            className="w-full h-20 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
         />
      </div>

      {/* PLAN EDITOR */}
      <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" /> Execution Plan
          </h3>
          {plan.length > 0 && (
            <button
              onClick={() => onLaunch(plan, context)}
              disabled={isRunning}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isRunning ? 'Running...' : 'LAUNCH MISSION'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {plan.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-lg">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Enter a goal and click Generate to start.</p>
            </div>
          ) : (
            plan.map((step, idx) => (
              <div key={idx} className="flex gap-3 bg-slate-900/50 p-3 rounded border border-slate-800/50">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      {agents.find(a => a.id === step.agentId)?.role || 'Unknown Agent'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{step.instruction}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}