import React, { useState, useEffect } from 'react';
import { MessageSquare, Network, TrendingUp } from 'lucide-react';

interface CommunicationLogsProps {
  backendUrl: string;
  missionId?: number;
}

export default function CommunicationLogs({ backendUrl, missionId }: CommunicationLogsProps) {
  const [communications, setCommunications] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<number | undefined>(missionId);

  // Convert WebSocket URL to HTTP URL for REST API calls
  const httpUrl = backendUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/ws$/, '')
    .replace(/\/$/, ''); // Remove trailing slash if present

  useEffect(() => {
    if (selectedMissionId) {
      fetchCommunications();
      fetchPatterns();
    }
  }, [selectedMissionId]);

  const fetchCommunications = async () => {
    if (!selectedMissionId) return;
    try {
      const res = await fetch(`${httpUrl}/api/communications/${selectedMissionId}`);
      const data = await res.json();
      setCommunications(data.communications || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
    }
  };

  const fetchPatterns = async () => {
    if (!selectedMissionId) return;
    try {
      const res = await fetch(`${httpUrl}/api/communications/${selectedMissionId}/patterns`);
      const data = await res.json();
      setPatterns(data);
    } catch (error) {
      console.error('Error fetching patterns:', error);
    }
  };

  if (!selectedMissionId) {
    return (
      <div className="p-6 text-center text-slate-400">
        Select a mission to view communication logs
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-indigo-500" />
        <h2 className="text-2xl font-bold text-slate-800">Agent Communication Logs</h2>
      </div>

      {/* Communication Patterns */}
      {patterns && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-lg">Communication Patterns</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Total Communications</div>
              <div className="text-2xl font-bold text-slate-800">{patterns.total_communications}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Unique Agents</div>
              <div className="text-2xl font-bold text-slate-800">{patterns.unique_agents}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Message Types</div>
              <div className="text-2xl font-bold text-slate-800">{Object.keys(patterns.message_type_distribution || {}).length}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Interactions</div>
              <div className="text-2xl font-bold text-slate-800">{Object.keys(patterns.agent_interactions || {}).length}</div>
            </div>
          </div>

          {patterns.message_type_distribution && (
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Message Type Distribution</h4>
              <div className="space-y-2">
                {Object.entries(patterns.message_type_distribution).map(([type, count]: [string, any]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{type}</span>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Communication Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-lg mb-4">Communication Timeline</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {communications.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No communications recorded</p>
          ) : (
            communications.map((comm) => (
              <div key={comm.id} className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-shrink-0 w-24 text-xs text-slate-500">
                  {new Date(comm.timestamp).toLocaleTimeString()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-700">{comm.from_agent}</span>
                    {comm.to_agent && (
                      <>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-slate-700">{comm.to_agent}</span>
                      </>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      comm.message_type === 'DELEGATION' ? 'bg-blue-100 text-blue-700' :
                      comm.message_type === 'RESPONSE' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {comm.message_type}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">{comm.content}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
