import React, { useEffect, useRef } from 'react';
import { Terminal, StopCircle, Activity } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  agentName: string;
  type: 'THOUGHT' | 'ACTION' | 'OUTPUT' | 'SYSTEM' | 'ERROR' | 'STREAM';
  content: string;
}

interface LiveMonitorProps {
  logs: LogEntry[];
  isRunning: boolean;
  onStop: () => void;
}

export default function LiveMonitor({ logs, isRunning, onStop }: LiveMonitorProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Extract images from logs
  const images = logs
    .filter(l => l.content.includes('/static/plots/'))
    .map(l => {
        const match = l.content.match(/\/static\/plots\/[a-zA-Z0-9_]+\.png/);
        return match ? match[0] : null;
    })
    .filter(Boolean) as string[];

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const renderContent = (content: string) => {
    // Check for image URL
    const imgMatch = content.match(/(\/static\/plots\/[a-zA-Z0-9_]+\.png)/);
    if (imgMatch) {
        const parts = content.split(imgMatch[0]);
        // Assuming backendUrl is ws, we need http
        const httpBase = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('/ws', '') : 'http://localhost:8000';
        return (
            <div>
                {parts[0]}
                <div className="my-2 border border-slate-700 rounded overflow-hidden max-w-md">
                    <img src={`${httpBase}${imgMatch[0]}`} alt="Generated Chart" className="w-full" />
                </div>
                {parts[1]}
            </div>
        );
    }
    return <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-300">{content}</p>;
  };

  return (
    <div className="flex h-full bg-slate-950">
      {/* Main Log Area */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
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
                  {renderContent(log.content)}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
      </div>

      {/* Dashboard Panel (Right Side) */}
      {images.length > 0 && (
          <div className="w-64 bg-slate-900 flex flex-col border-l border-slate-800">
              <div className="h-10 border-b border-slate-800 bg-slate-900/50 flex items-center px-4 font-bold text-xs uppercase text-indigo-400">
                  <Activity className="w-3 h-3 mr-2" /> Data Dashboard
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {images.map((img, i) => {
                      const httpBase = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('ws://', 'http://').replace('/ws', '') : 'http://localhost:8000';
                       return (
                          <div key={i} className="border border-slate-700 rounded overflow-hidden bg-slate-950">
                              <img src={`${httpBase}${img}`} alt={`Chart ${i}`} className="w-full" />
                              <div className="p-2 text-[10px] text-slate-500 text-center border-t border-slate-800">Chart #{i+1}</div>
                          </div>
                      )
                  })}
              </div>
          </div>
      )}
    </div>
  );
}
