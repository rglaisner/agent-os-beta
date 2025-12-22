import React from 'react';
import LiveMonitor from '../components/LiveMonitor';
import MissionHistory from '../components/MissionHistory';
import { useStore } from '../store';
import { Flag } from 'lucide-react';

const MonitorPage = () => {
  const { logs, isRunning, stopSimulation, handleHumanResponse, finalOutput, backendUrl } = useStore();

  return (
    <main className="container mx-auto p-4 flex flex-col gap-6 flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden relative shadow-sm">
          <LiveMonitor logs={logs as any} isRunning={isRunning} onStop={stopSimulation} onHumanResponse={handleHumanResponse} />
        </div>
        {finalOutput && (
          <div className="bg-white rounded-xl border border-emerald-200 shadow-lg shadow-emerald-50 overflow-hidden flex flex-col max-h-[40vh] animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-emerald-50/50 px-4 py-3 border-b border-emerald-100 flex items-center gap-2">
              <div className="bg-emerald-100 p-1 rounded-md text-emerald-600"><Flag className="w-4 h-4" /></div>
              <h3 className="font-bold text-emerald-900 text-sm uppercase tracking-wider">Mission Accomplished</h3>
            </div>
            <div className="p-6 overflow-y-auto bg-white">
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">{finalOutput}</pre>
            </div>
          </div>
        )}
        <div className={`${finalOutput ? 'h-32 opacity-75' : 'h-64'} transition-all duration-500`}><MissionHistory backendUrl={backendUrl} /></div>
      </div>
    </main>
  );
};

export default MonitorPage;
