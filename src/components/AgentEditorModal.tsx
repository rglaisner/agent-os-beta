import React, { useState, useEffect } from 'react';
import { X, Save, Bot } from 'lucide-react';
import { Agent, DEFAULT_TOOLS } from '../constants'; // Import shared types

interface AgentEditorModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

export default function AgentEditorModal({ agent, isOpen, onClose, onSave }: AgentEditorModalProps) {
  const [formData, setFormData] = useState<Agent>(agent);

  // Initialize form data when modal opens, but only if agent changes
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => prev.id === agent.id ? prev : { ...agent });
    }
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Agent, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleToolToggle = (toolId: string) => {
      const currentTools = formData.toolIds;
      const newTools = currentTools.includes(toolId)
          ? currentTools.filter(id => id !== toolId)
          : [...currentTools, toolId];
      handleChange('toolIds', newTools);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><Bot className="w-5 h-5" /></div>
                Edit Agent
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role Name</label>
                    <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => handleChange('role', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Max Iterations</label>
                    <input
                        type="number"
                        value={formData.max_iter || 25}
                        onChange={(e) => handleChange('max_iter', parseInt(e.target.value))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Backstory</label>
                <textarea
                    value={formData.backstory}
                    onChange={(e) => handleChange('backstory', e.target.value)}
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Goal</label>
                <textarea
                    value={formData.goal}
                    onChange={(e) => handleChange('goal', e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
            </div>

             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tools</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50">
                    {DEFAULT_TOOLS.map(tool => (
                        <label key={tool.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${formData.toolIds.includes(tool.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
                            <input
                                type="checkbox"
                                checked={formData.toolIds.includes(tool.id)}
                                onChange={() => handleToolToggle(tool.id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                                <div className="text-xs font-bold text-slate-700">{tool.name}</div>
                                <div className="text-[10px] text-slate-500 truncate w-32">{tool.description}</div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.reasoning || false}
                        onChange={(e) => handleChange('reasoning', e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Allow Delegation / Reasoning</span>
                </label>
            </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button onClick={() => { onSave(formData); onClose(); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all active:scale-95">
                <Save className="w-4 h-4" /> Save Changes
            </button>
        </div>
      </div>
    </div>
  );
}
