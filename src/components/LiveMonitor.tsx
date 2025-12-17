import React, { useEffect, useRef } from 'react';
import { Terminal, StopCircle } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  agentName: string;
  type: 'THOUGHT' | 'ACTION' | 'OUTPUT' | 'SYSTEM' | 'ERROR';
  content: string;
}

interface LiveMonitorProps {
  logs: LogEntry[];
  isRunning: boolean;
  onStop: () => void;
}

export default function LiveMonitor({ logs, isRunning, onStop }: LiveMonitorProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-wider">Live Terminal</span>
        </div>
        {isRunning && (
          <button onClick={onStop} className="flex items-center gap-2 px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded border border-red-800 transition-all">
            <StopCircle className="w-3 h-3" /> STOP
          </button>
        )}
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-3">
        {logs.length === 0 && (
          <div className="text-slate-600 text-center mt-10 italic">
            Ready to initialize mission...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 animate-in fade-in duration-300">
            <span className="text-slate-600 text-[10px] shrink-0 pt-1">
                {log.timestamp.split('T')[1]?.split('.')[0] || '00:00:00'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] px-1.5 py-0 rounded font-bold uppercase tracking-wider ${
                  log.type === 'THOUGHT' ? 'bg-indigo-900/30 text-indigo-400' :
                  log.type === 'ACTION' ? 'bg-amber-900/30 text-amber-400' :
                  log.type === 'ERROR' ? 'bg-red-900/30 text-red-400' :
                  log.type === 'OUTPUT' ? 'bg-green-900/30 text-green-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {log.agentName}
                </span>
              </div>
              <p className={`whitespace-pre-wrap break-words leading-relaxed ${
                 log.type === 'ERROR' ? 'text-red-300' : 'text-slate-300'
              }`}>
                {log.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}