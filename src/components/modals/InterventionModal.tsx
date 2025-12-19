import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, RotateCw } from 'lucide-react';

interface InterventionData {
  agentName: string;
  instruction: string;
  failedOutput: string;
  score: number;
  threshold: number;
  feedback: string;
}

interface InterventionModalProps {
  requestId: string;
  data: InterventionData;
  onResponse: (requestId: string, action: 'PROCEED' | 'IGNORE' | 'RETRY' | 'CANCEL') => void;
}

export default function InterventionModal({ requestId, data, onResponse }: InterventionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Human Intervention Required</h2>
            <p className="text-sm text-slate-500">
              Agent <span className="font-semibold text-slate-700">{data.agentName}</span> failed to meet quality standards after 3 attempts.
            </p>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Instruction */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Original Instruction</h3>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
              {data.instruction}
            </div>
          </div>

          {/* Grading Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
               <span className="block text-xs text-red-500 font-bold uppercase mb-1">Score</span>
               <span className="text-2xl font-black text-red-700">{data.score}/100</span>
               <span className="text-xs text-red-400 ml-2">(Threshold: {data.threshold})</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
               <span className="block text-xs text-slate-400 font-bold uppercase mb-1">Feedback</span>
               <span className="text-sm text-slate-600 leading-snug">{data.feedback}</span>
            </div>
          </div>

          {/* Failed Output */}
          <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Failed Output (Attempt 3)</h3>
             <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs overflow-auto max-h-48 border border-slate-800">
                {data.failedOutput}
             </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap gap-3 justify-end">
            <button
                onClick={() => onResponse(requestId, 'CANCEL')}
                className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors mr-auto"
            >
                <XCircle className="w-4 h-4" /> Cancel Mission
            </button>

            <button
                onClick={() => onResponse(requestId, 'IGNORE')}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
                Ignore Step
            </button>

            <button
                onClick={() => onResponse(requestId, 'RETRY')}
                className="px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
                <RotateCw className="w-4 h-4" /> Retry (+2 Attempts)
            </button>

            <button
                onClick={() => onResponse(requestId, 'PROCEED')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm shadow-emerald-200 transition-colors"
            >
                <CheckCircle className="w-4 h-4" /> Proceed Anyway
            </button>
        </div>
      </div>
    </div>
  );
}
