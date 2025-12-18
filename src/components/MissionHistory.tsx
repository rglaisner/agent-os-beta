import React, { useEffect, useState } from 'react';
import { Clock, DollarSign, CheckCircle, XCircle, FileText } from 'lucide-react';

interface Mission {
  id: number;
  goal: string;
  status: string;
  created_at: string;
  estimated_cost: number;
  total_tokens: number;
}

interface MissionHistoryProps {
  backendUrl: string; // We'll pass the HTTP url here
}

export default function MissionHistory({ backendUrl }: MissionHistoryProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert WebSocket URL (wss://) to HTTP URL (https://) for the API
  const httpUrl = backendUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace(/\/ws$/, '');

  useEffect(() => {
    fetch(`${httpUrl}/api/missions`)
      .then(res => res.json())
      .then(data => {
        setMissions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
        setLoading(false);
      });
  }, [httpUrl]);

  if (loading) return <div className="p-4 text-slate-400">Loading history...</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-3 bg-slate-950 border-b border-slate-800 font-bold text-slate-300 flex items-center gap-2">
        <Clock className="w-4 h-4" /> Recent Missions
      </div>
      <div className="max-h-64 overflow-y-auto">
        {missions.map((m) => (
          <div key={m.id} className="p-3 border-b border-slate-800 hover:bg-slate-800 transition-colors flex justify-between items-center group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  m.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' : 
                  m.status === 'FAILED' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                }`}>
                  {m.status}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-300 truncate font-mono" title={m.goal}>
                {m.goal}
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-slate-500 ml-4">
               <div className="flex items-center gap-1" title="Estimated Cost">
                  <DollarSign className="w-3 h-3 text-slate-600" />
                  ${m.estimated_cost.toFixed(4)}
               </div>
               {/* Placeholder for 'View Details' - we can expand this later */}
               <FileText className="w-4 h-4 opacity-0 group-hover:opacity-100 cursor-pointer text-indigo-400" />
            </div>
          </div>
        ))}
        {missions.length === 0 && (
          <div className="p-8 text-center text-slate-600 text-sm">No missions recorded yet.</div>
        )}
      </div>
    </div>
  );
}