import React, { useState, useEffect } from 'react';
import { Agent, DEFAULT_TOOLS } from '../constants';

interface AgentEditorModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAgent: Agent) => void;
}

const AgentEditorModal: React.FC<AgentEditorModalProps> = ({ agent, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<Agent>({ ...agent });

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...agent });
    }
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Agent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTool = (toolId: string) => {
    setFormData(prev => {
      const tools = new Set(prev.toolIds);
      if (tools.has(toolId)) tools.delete(toolId);
      else tools.add(toolId);
      return { ...prev, toolIds: Array.from(tools) };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-white">Edit Agent: {formData.role}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
            <input
              value={formData.role}
              onChange={e => handleChange('role', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Goal</label>
            <textarea
              value={formData.goal}
              onChange={e => handleChange('goal', e.target.value)}
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Backstory</label>
            <textarea
              value={formData.backstory}
              onChange={e => handleChange('backstory', e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="humanInput"
              checked={formData.humanInput || false}
              onChange={e => handleChange('humanInput', e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-700"
            />
            <label htmlFor="humanInput" className="text-sm font-medium text-white">Human-in-the-Loop (Review Output)</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Tools</label>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_TOOLS.map(tool => (
                <div key={tool.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 border border-transparent hover:border-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.toolIds.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-700"
                  />
                  <div>
                    <div className="text-sm text-white">{tool.name}</div>
                    <div className="text-xs text-gray-500 truncate w-48">{tool.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-800 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700">Cancel</button>
          <button
            onClick={() => { onSave(formData); onClose(); }}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentEditorModal;
