import React, { useState } from 'react';
import { Users, Check, X, UserPlus } from 'lucide-react';
import { type Agent } from '../constants';

interface NewAgentsModalProps {
  agents: Agent[];
  onAccept: (selectedIds: string[]) => void;
  onReject: () => void;
}

export default function NewAgentsModal({ agents, onAccept, onReject }: NewAgentsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(agents.map(a => a.id)));

  const toggleAgent = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleAccept = () => {
    onAccept(Array.from(selectedIds));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-full">
            <UserPlus className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">New Agents Proposed</h2>
            <p className="text-sm text-slate-500">
              The planner suggests adding these agents to your team.
            </p>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {agents.map(agent => (
                <div 
                    key={agent.id} 
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedIds.has(agent.id) ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${selectedIds.has(agent.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                        {selectedIds.has(agent.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">{agent.role}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{agent.systemPrompt}</p>
                    </div>
                </div>
            ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
                onClick={onReject}
                className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
                <X className="w-4 h-4" /> Reject All
            </button>
            <button
                onClick={handleAccept}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm shadow-indigo-200 transition-colors"
            >
                <Check className="w-4 h-4" /> Accept Selected
            </button>
        </div>
      </div>
    </div>
  );
}
