import React, { useEffect, useState } from 'react';
import { Clock, DollarSign, FileText } from 'lucide-react';

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
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Backend returns {missions: [...]}
        const missionsList = Array.isArray(data) ? data : (data.missions || []);
        setMissions(missionsList);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
        setMissions([]);
        setLoading(false);
      });
  }, [httpUrl]);

  if (loading) return <div className="p-4 text-slate-400 text-sm">Loading history...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider">
        <Clock className="w-4 h-4 text-indigo-500" /> Recent Missions
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        {missions.map((m) => (
          <div key={m.id} className="p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex justify-between items-center group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                  m.status === 'COMPLETED' ? 'bg-green-50 text-green-600 border-green-100' :
                  m.status === 'FAILED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                  {m.status}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-600 truncate font-medium" title={m.goal}>
                {m.goal}
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-slate-400 ml-4">
               <div className="flex items-center gap-1" title="Estimated Cost">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  ${m.estimated_cost.toFixed(4)}
               </div>
               {/* Placeholder for 'View Details' - we can expand this later */}
               <FileText className="w-4 h-4 opacity-0 group-hover:opacity-100 cursor-pointer text-indigo-500 hover:text-indigo-700 transition-opacity" />
            </div>
          </div>
        ))}
        {missions.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm italic">No missions recorded yet.</div>
        )}
      </div>
    </div>
  );
}
