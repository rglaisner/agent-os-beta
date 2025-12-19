import React, { useEffect, useRef, useState } from 'react';
import { Terminal, StopCircle, Activity } from 'lucide-react';
import InterventionModal from './modals/InterventionModal';

interface LogEntry {
  timestamp: string;
  agentName: string;
  type: 'THOUGHT' | 'ACTION' | 'OUTPUT' | 'SYSTEM' | 'ERROR' | 'STREAM' | 'TERMINAL' | 'INTERVENTION_REQUIRED';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any; // Can be string or object
  requestId?: string;
}

interface LiveMonitorProps {
  logs: LogEntry[];
  isRunning: boolean;
  onStop: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHumanResponse?: (requestId: string, content: any) => void;
}

export default function LiveMonitor({ logs, isRunning, onStop, onHumanResponse }: LiveMonitorProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Extract images from logs
  const images = logs
    .filter(l => typeof l.content === 'string' && l.content.includes('/static/plots/'))
    .map(l => {
        if (typeof l.content !== 'string') return null;
        const match = l.content.match(/\/static\/plots\/[a-zA-Z0-9_]+\.png/);
        const content = typeof l.content === 'string' ? l.content : String(l.content);
        const match = content.match(/\/static\/plots\/[a-zA-Z0-9_]+\.png/);
        return match ? match[0] : null;
    })
    .filter(Boolean) as string[];

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const [activeIntervention, setActiveIntervention] = useState<LogEntry | null>(null);

  // Check for new interventions
  useEffect(() => {
      const lastLog = logs[logs.length - 1];
      if (lastLog && (lastLog.type === 'INTERVENTION_REQUIRED' || lastLog.type === 'HUMAN_INPUT_REQUEST')) {
          // Validate that we have required data
          if (lastLog.requestId && lastLog.content) {
              // Only set if we don't already have an active intervention
              if (!activeIntervention) {
                  setActiveIntervention(lastLog);
              }
          } else {
              console.warn('Human input request missing required fields:', lastLog);
          }
      }
  }, [logs, activeIntervention]);

  const handleInterventionResponse = (requestId: string, action: 'PROCEED' | 'IGNORE' | 'RETRY' | 'CANCEL') => {
      if (onHumanResponse) {
          onHumanResponse(requestId, { action });
      }
      setActiveIntervention(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderContent = (content: any) => {
    if (typeof content !== 'string') {
      // Handle non-string content (objects, arrays, etc.)
      try {
        return <pre className="whitespace-pre-wrap break-words leading-relaxed text-slate-700 font-mono text-xs">{JSON.stringify(content, null, 2)}</pre>;
      } catch {
        return <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">[Non-string content]</p>;
      }
    }

    // Check for image URL
    const imgMatch = content.match(/(\/static\/plots\/[a-zA-Z0-9_]+\.png)/);
    if (imgMatch) {
        const parts = content.split(imgMatch[0]);
        // Assuming backendUrl is ws, we need http
        const httpBase = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('/ws', '') : 'http://localhost:8000';
        return (
            <div>
                {parts[0]}
                <div className="my-2 border border-slate-200 rounded overflow-hidden max-w-md shadow-sm">
                    <img src={`${httpBase}${imgMatch[0]}`} alt="Generated Chart" className="w-full" />
                </div>
                {parts[1]}
            </div>
        );
    }
    return <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">{content}</p>;
  };

  return (
    <div className="flex h-full bg-white text-sm relative">
      {/* Intervention Modal */}
      {activeIntervention && (
          <InterventionModal
            requestId={activeIntervention.requestId || ''}
            data={activeIntervention.content}
            onResponse={handleInterventionResponse}
          />
      )}

      {/* Main Log Area */}
      <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded shadow-sm border border-slate-200">
                  <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">Live Terminal</span>
            </div>
            {isRunning && (
              <button onClick={onStop} className="flex items-center gap-2 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded border border-red-200 transition-all font-bold">
                <StopCircle className="w-3 h-3" /> STOP
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 font-mono space-y-4 bg-white">
            {logs.length === 0 && (
              <div className="text-slate-400 text-center mt-20 italic flex flex-col items-center">
                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                Ready to initialize mission...
              </div>
            )}
            {logs.filter(l => l.type !== 'INTERVENTION_REQUIRED').map((log, i) => (
              <div key={i} className="flex gap-4 animate-in fade-in duration-300 group">
                <span className="text-slate-400 text-[10px] shrink-0 pt-1 select-none w-12 text-right">
                    {log.timestamp.split('T')[1]?.split('.')[0] || '00:00:00'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border shadow-sm ${
                      log.type === 'THOUGHT' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      log.type === 'ACTION' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      log.type === 'ERROR' ? 'bg-red-50 text-red-600 border-red-100' :
                      log.type === 'OUTPUT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      log.type === 'TERMINAL' ? 'bg-gray-800 text-gray-200 border-gray-700' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {log.type === 'TERMINAL' ? 'LOG' : log.agentName}
                    </span>
                  </div>
                  <div className={`${log.type === 'TERMINAL' ? 'font-mono text-xs text-slate-600' : ''}`}>
                    {renderContent(log.content)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
      </div>

      {/* Dashboard Panel (Right Side) */}
      {images.length > 0 && (
          <div className="w-72 bg-slate-50 flex flex-col border-l border-slate-200 shadow-xl shadow-slate-200 z-10">
              <div className="h-12 border-b border-slate-200 bg-white flex items-center px-4 font-bold text-xs uppercase text-indigo-600 tracking-wider">
                  <Activity className="w-4 h-4 mr-2" /> Data Dashboard
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {images.map((img, i) => {
                      const httpBase = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('/ws', '') : 'http://localhost:8000';
                       return (
                          <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                              <img src={`${httpBase}${img}`} alt={`Chart ${i}`} className="w-full bg-slate-50" />
                              <div className="p-2 text-[10px] text-slate-500 text-center border-t border-slate-100 font-medium">Chart #{i+1}</div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}
    </div>
  );
}
