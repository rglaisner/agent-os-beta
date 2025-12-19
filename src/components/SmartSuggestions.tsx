import React, { useState } from 'react';
import { Sparkles, Lightbulb, Wrench, Network } from 'lucide-react';
import type { Agent } from '../constants';

interface SmartSuggestionsProps {
  backendUrl: string;
  goal: string;
  availableAgents: Agent[];
  availableTools: string[];
  onApplySuggestions?: (agents: Agent[], tools: string[]) => void;
}

export default function SmartSuggestions({
  backendUrl,
  goal,
  availableAgents,
  availableTools,
  onApplySuggestions
}: SmartSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [agentSuggestions, setAgentSuggestions] = useState<any>(null);
  const [toolSuggestions, setToolSuggestions] = useState<any>(null);
  const [composition, setComposition] = useState<any>(null);

  const httpUrl = backendUrl.replace('ws://', 'http://').replace('/ws', '');

  const fetchAgentSuggestions = async () => {
    if (!goal.trim()) {
      alert('Please enter a mission goal first');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/suggestions/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          available_agents: availableAgents,
          available_tools: availableTools
        })
      });
      const data = await res.json();
      setAgentSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      alert('Failed to get agent suggestions');
    }
    setLoading(false);
  };

  const fetchToolSuggestions = async () => {
    if (!goal.trim()) {
      alert('Please enter a mission goal first');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/suggestions/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          available_agents: availableAgents,
          available_tools: availableTools
        })
      });
      const data = await res.json();
      setToolSuggestions(data);
    } catch (error) {
      console.error('Error fetching tool suggestions:', error);
      alert('Failed to get tool suggestions');
    }
    setLoading(false);
  };

  const fetchComposition = async () => {
    if (!goal.trim()) {
      alert('Please enter a mission goal first');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/suggestions/composition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          available_agents: availableAgents,
          available_tools: availableTools
        })
      });
      const data = await res.json();
      setComposition(data);
    } catch (error) {
      console.error('Error fetching composition:', error);
      alert('Failed to get composition optimization');
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-lg text-slate-800">Smart Agent Suggestions</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={fetchAgentSuggestions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Lightbulb className="w-4 h-4" />
          Suggest Agents
        </button>
        <button
          onClick={fetchToolSuggestions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Wrench className="w-4 h-4" />
          Suggest Tools
        </button>
        <button
          onClick={fetchComposition}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          <Network className="w-4 h-4" />
          Optimize Composition
        </button>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">Generating suggestions...</div>
      )}

      {agentSuggestions && (
        <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <h4 className="font-bold text-sm mb-3 text-indigo-900">Recommended Agents</h4>
          <div className="space-y-2">
            {agentSuggestions.recommended_agents?.map((agent: any, idx: number) => (
              <div key={idx} className="text-sm text-slate-700 bg-white p-3 rounded border border-indigo-100">
                <div className="font-medium">{agent.id}</div>
                <div className="text-xs text-slate-500 mt-1">{agent.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toolSuggestions && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-bold text-sm mb-3 text-blue-900">Tool Assignments</h4>
          <div className="space-y-2">
            {toolSuggestions.tool_assignments?.map((assignment: any, idx: number) => (
              <div key={idx} className="text-sm text-slate-700 bg-white p-3 rounded border border-blue-100">
                <div className="font-medium">{assignment.agent_id}</div>
                <div className="text-xs text-slate-600 mt-1">Tools: {assignment.recommended_tools?.join(', ')}</div>
                <div className="text-xs text-slate-500 mt-1">{assignment.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {composition && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h4 className="font-bold text-sm mb-3 text-purple-900">Optimal Composition</h4>
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <span className="font-medium">Structure: </span>
              <span className="text-purple-600">{composition.optimal_structure}</span>
            </div>
            <div>
              <span className="font-medium">Agent Order: </span>
              <span className="text-purple-600">{composition.agent_order?.join(' → ')}</span>
            </div>
            <div className="text-xs text-slate-600 mt-2">{composition.reasoning}</div>
            {composition.potential_bottlenecks && composition.potential_bottlenecks.length > 0 && (
              <div className="mt-3">
                <div className="font-medium text-xs text-orange-700">Potential Bottlenecks:</div>
                <ul className="list-disc list-inside text-xs text-slate-600 mt-1">
                  {composition.potential_bottlenecks.map((b: string, idx: number) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
