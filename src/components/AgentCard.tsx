import React, { useState } from 'react';
import { Bot, Trash2, ChevronDown, ChevronUp, Wrench } from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  description: string;
}

interface Agent {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  toolIds: string[];
  humanInput: boolean;
}

interface AgentCardProps {
  agent: Agent;
  availableTools: Tool[];
  onUpdate: (id: string, updates: Partial<Agent>) => void;
  onRemove: (id: string) => void;
}

const AgentCard = React.memo(({ agent, availableTools, onUpdate, onRemove }: AgentCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleTool = (toolId: string) => {
    const current = agent.toolIds;
    const updated = current.includes(toolId)
      ? current.filter(id => id !== toolId)
      : [...current, toolId];
    onUpdate(agent.id, { toolIds: updated });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all hover:border-indigo-300 hover:shadow-md group shadow-sm">
      {/* Header (Always Visible) */}
      <div className="p-3 flex items-start gap-3 cursor-pointer bg-white" onClick={() => setIsExpanded(!isExpanded)}>
        <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
          <Bot className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm truncate pr-2 group-hover:text-indigo-700 transition-colors">{agent.role}</h3>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
          <p className="text-xs text-slate-500 truncate">{agent.goal}</p>
          
          {/* Mini Badges */}
          {!isExpanded && (
            <div className="flex gap-2 mt-2">
              {agent.toolIds.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 font-medium">
                  <Wrench className="w-3 h-3" /> {agent.toolIds.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Config */}
      {isExpanded && (
        <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
          
          {/* Role & Goal */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Role</label>
              <input 
                type="text" 
                value={agent.role}
                onChange={(e) => onUpdate(agent.id, { role: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Goal</label>
              <input 
                type="text" 
                value={agent.goal}
                onChange={(e) => onUpdate(agent.id, { goal: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Tools Selection */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
              <Wrench className="w-3 h-3" /> Tools ({agent.toolIds.length})
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`flex items-center gap-3 p-2 rounded text-left text-xs transition-colors border shadow-sm ${
                    agent.toolIds.includes(tool.id) 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border ${agent.toolIds.includes(tool.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-slate-100'}`} />
                  <div>
                    <span className="font-bold block">{tool.name}</span>
                    <span className="opacity-70 text-[10px]">{tool.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-between items-center border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer group">
               <input 
                 type="checkbox" 
                 checked={agent.humanInput}
                 onChange={(e) => onUpdate(agent.id, { humanInput: e.target.checked })}
                 className="rounded bg-slate-100 border-slate-300 text-indigo-600 focus:ring-indigo-500"
               />
               <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors font-medium">Allow Human Input</span>
            </label>

            <button 
              onClick={() => onRemove(agent.id)}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors font-medium"
            >
              <Trash2 className="w-3 h-3" /> Remove Agent
            </button>
          </div>

        </div>
      )}
    </div>
  );
});

export default AgentCard;
