import React, { useState } from 'react';
import { Bug, Play, Pause, StepForward, Eye, AlertTriangle } from 'lucide-react';

interface DebuggingToolsProps {
  logs: any[];
  isRunning: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStep?: () => void;
}

export default function DebuggingTools({
  logs,
  isRunning,
  onPause,
  onResume,
  onStep
}: DebuggingToolsProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'errors') return log.type === 'ERROR';
    if (filter === 'actions') return log.type === 'ACTION';
    if (filter === 'outputs') return log.type === 'OUTPUT';
    return true;
  });

  const errorCount = logs.filter(l => l.type === 'ERROR').length;
  const warningCount = logs.filter(l => l.type === 'WARNING').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-lg text-slate-800">Mission Debugging Tools</h3>
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {errorCount} Errors
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} Warnings
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
        {isRunning ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        ) : (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors text-sm"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        <button
          onClick={onStep}
          disabled={isRunning}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
        >
          <StepForward className="w-4 h-4" />
          Step Forward
        </button>
        <button
          onClick={() => setShowVariables(!showVariables)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
        >
          <Eye className="w-4 h-4" />
          {showVariables ? 'Hide' : 'Show'} Variables
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
        >
          <option value="all">All Logs</option>
          <option value="errors">Errors Only</option>
          <option value="actions">Actions Only</option>
          <option value="outputs">Outputs Only</option>
        </select>
      </div>

      {/* Step Navigation */}
      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="text-xs text-slate-600 mb-2">Step Navigation</div>
        <div className="flex gap-2 flex-wrap">
          {logs.map((log, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedStep(idx)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                selectedStep === idx
                  ? 'bg-indigo-600 text-white'
                  : log.type === 'ERROR'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Variable Inspector */}
      {showVariables && selectedStep !== null && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs font-medium text-purple-900 mb-2">Variable Inspector (Step {selectedStep + 1})</div>
          <div className="text-xs text-slate-600">
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {JSON.stringify(logs[selectedStep]?.content || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Error Trace */}
      {errorCount > 0 && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-xs font-medium text-red-900 mb-2">Error Trace</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {logs
              .filter(l => l.type === 'ERROR')
              .map((log, idx) => (
                <div key={idx} className="text-xs text-red-700">
                  {log.agentName}: {String(log.content).substring(0, 100)}
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-500 mt-4">
        <p>💡 <strong>Tip for non-technical users:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Use <strong>Pause</strong> to stop execution and inspect the current state</li>
          <li>Use <strong>Step Forward</strong> to execute one step at a time</li>
          <li>Click step numbers to jump to specific points in execution</li>
          <li>Filter logs to focus on errors or specific types of events</li>
          <li>Check the Error Trace section if you see red error indicators</li>
        </ul>
      </div>
    </div>
  );
}
