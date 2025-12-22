import React, { useState } from 'react';
import { Download, FileText, FileJson, FileCode } from 'lucide-react';

interface ExportToolsProps {
  backendUrl: string;
  missionId: number;
}

export default function ExportTools({ backendUrl, missionId }: ExportToolsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  // Convert WebSocket URL to HTTP URL for REST API calls
  const httpUrl = backendUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/ws$/, '')
    .replace(/\/$/, ''); // Remove trailing slash if present

  const handleExport = async (format: 'json' | 'markdown' | 'pdf') => {
    setExporting(format);
    try {
      const res = await fetch(`${httpUrl}/api/export/${missionId}/${format}`);
      if (format === 'pdf') {
        const data = await res.json();
        alert(data.message || 'PDF export requires additional setup');
        setExporting(null);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mission_${missionId}.${format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export mission');
    }
    setExporting(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-lg text-slate-800">Export Mission Results</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => handleExport('json')}
          disabled={!!exporting}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <FileJson className="w-8 h-8 text-blue-500" />
          <span className="text-sm font-medium">JSON</span>
          {exporting === 'json' && <span className="text-xs text-slate-500">Exporting...</span>}
        </button>
        <button
          onClick={() => handleExport('markdown')}
          disabled={!!exporting}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <FileText className="w-8 h-8 text-emerald-500" />
          <span className="text-sm font-medium">Markdown</span>
          {exporting === 'markdown' && <span className="text-xs text-slate-500">Exporting...</span>}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={!!exporting}
          className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
        >
          <FileCode className="w-8 h-8 text-red-500" />
          <span className="text-sm font-medium">PDF</span>
          {exporting === 'pdf' && <span className="text-xs text-slate-500">Exporting...</span>}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-4 text-center">
        Export mission results, events, and communications in your preferred format
      </p>
    </div>
  );
}
