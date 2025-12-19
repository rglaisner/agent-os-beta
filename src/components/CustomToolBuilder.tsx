import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Play, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface CustomToolBuilderProps {
  backendUrl: string;
}

export default function CustomToolBuilder({ backendUrl }: CustomToolBuilderProps) {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tool_type: 'FUNCTION',
    code: '',
    parameters: '{}',
    test_cases: '[]'
  });

  const httpUrl = backendUrl.replace('ws://', 'http://').replace('/ws', '');

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/tools/custom/list?active_only=false`);
      const data = await res.json();
      setTools(data.tools || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/tools/custom/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parameters: JSON.parse(formData.parameters),
          test_cases: JSON.parse(formData.test_cases)
        })
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', description: '', tool_type: 'FUNCTION', code: '', parameters: '{}', test_cases: '[]' });
        fetchTools();
      }
    } catch (error) {
      console.error('Error creating tool:', error);
      alert('Failed to create tool');
    }
    setLoading(false);
  };

  const handleTest = async (toolId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/tools/custom/${toolId}/test`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchTools();
      }
    } catch (error) {
      console.error('Error testing tool:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (toolId: number) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;
    try {
      const res = await fetch(`${httpUrl}/api/tools/custom/${toolId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTools();
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-indigo-500" />
          <h2 className="text-2xl font-bold text-slate-800">Custom Tool Builder</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Tool
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4">Create New Tool</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="tool-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="What does this tool do?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={formData.tool_type}
                onChange={e => setFormData({ ...formData, tool_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="FUNCTION">Function</option>
                <option value="API">API</option>
                <option value="SCRIPT">Script</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
              <textarea
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-sm"
                rows={6}
                placeholder="def tool_function(input):&#10;    # Your code here&#10;    return result"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parameters (JSON)</label>
              <textarea
                value={formData.parameters}
                onChange={e => setFormData({ ...formData, parameters: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-sm"
                rows={3}
                placeholder='{"param1": "type", "param2": "type"}'
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Cases (JSON)</label>
              <textarea
                value={formData.test_cases}
                onChange={e => setFormData({ ...formData, test_cases: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-sm"
                rows={3}
                placeholder='[{"input": {...}, "expected_output": "..."}]'
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map(tool => (
          <div key={tool.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-slate-800">{tool.name}</h3>
                <p className="text-sm text-slate-600">{tool.description}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                tool.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {tool.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="text-xs text-slate-500 mb-3">Type: {tool.tool_type}</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTest(tool.id)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Play className="w-3 h-3" />
                Test
              </button>
              <button
                onClick={() => handleDelete(tool.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
            {tool.last_tested && (
              <div className="text-xs text-slate-400 mt-2">
                Last tested: {new Date(tool.last_tested).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
