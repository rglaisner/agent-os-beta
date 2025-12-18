import React, { useState, useEffect } from 'react';
import { Book, Upload, FileText, Loader } from 'lucide-react';

interface KnowledgeBaseProps {
  backendUrl: string;
}

export default function KnowledgeBase({ backendUrl }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadSource, setUploadSource] = useState('');

  const httpUrl = backendUrl.replace('ws://', 'http://').replace('/ws', '');

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/knowledge`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async () => {
    if (!uploadText || !uploadSource) return;
    setLoading(true);
    try {
      await fetch(`${httpUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: uploadText, source: uploadSource })
      });
      setUploadText('');
      setUploadSource('');
      fetchDocs();
    } catch (e) {
      alert('Error uploading');
    }
    setLoading(false);
  };

  const handleFileIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      setLoading(true);
      const fd = new FormData();
      fd.append("file", e.target.files[0]);
      try {
          await fetch(`${httpUrl}/api/knowledge/upload`, { method: 'POST', body: fd });
          fetchDocs();
      } catch (e) { alert("Upload failed"); }
      setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full p-1 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manual Entry */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700 uppercase tracking-wider"><FileText className="w-4 h-4 text-indigo-500" /> Manual Entry</h2>
            <div className="flex flex-col gap-3">
                <input
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    placeholder="Source Name (e.g. 'Wiki')"
                    value={uploadSource}
                    onChange={e => setUploadSource(e.target.value)}
                />
                <textarea
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                    placeholder="Paste text content..."
                    value={uploadText}
                    onChange={e => setUploadText(e.target.value)}
                />
                <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg flex justify-center items-center gap-2 font-bold shadow-md shadow-indigo-100 transition-all active:scale-95"
                >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Book className="w-4 h-4" />}
                    Save to Memory
                </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
             <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Upload className="w-4 h-4 text-indigo-500" /> Upload Document</h2>
             <div className="flex flex-col gap-4 h-full justify-center items-center border-2 border-dashed border-slate-200 rounded-lg p-6 hover:bg-slate-50 hover:border-indigo-300 transition-colors relative group">
                <div className="bg-indigo-50 p-4 rounded-full group-hover:bg-indigo-100 transition-colors">
                    <Upload className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">Click to ingest PDF or Text files</p>
                    <p className="text-xs text-slate-400 mt-1">Files will be indexed for retrieval</p>
                </div>
                <input type="file" onChange={handleFileIngest} className="absolute inset-0 opacity-0 cursor-pointer" />
             </div>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1">
        <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Book className="w-4 h-4 text-indigo-500" /> Existing Documents</h2>
        {documents.length === 0 ? <p className="text-slate-400 italic text-sm border-2 border-dashed border-slate-100 p-8 text-center rounded-lg">No documents in long-term memory.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center gap-3 hover:border-indigo-200 hover:shadow-sm transition-all">
                        <div className="bg-white p-2 rounded border border-slate-100">
                            <FileText className="w-5 h-5 text-indigo-500" />
                        </div>
                        <span className="font-medium text-sm text-slate-700 truncate">{doc}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
