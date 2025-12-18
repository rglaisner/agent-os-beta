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
    <div className="flex flex-col gap-6 h-full p-4 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manual Entry */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-400" /> Manual Entry</h2>
            <div className="flex flex-col gap-3">
                <input
                    className="bg-slate-800 border border-slate-700 rounded p-2 text-sm"
                    placeholder="Source Name (e.g. 'Wiki')"
                    value={uploadSource}
                    onChange={e => setUploadSource(e.target.value)}
                />
                <textarea
                    className="bg-slate-800 border border-slate-700 rounded p-2 text-sm h-32"
                    placeholder="Paste text content..."
                    value={uploadText}
                    onChange={e => setUploadText(e.target.value)}
                />
                <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded flex justify-center items-center gap-2"
                >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Book className="w-4 h-4" />}
                    Save Text
                </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-indigo-400" /> Upload Document</h2>
             <div className="flex flex-col gap-4 h-full justify-center items-center border-2 border-dashed border-slate-700 rounded-lg p-6 hover:bg-slate-800 transition-colors relative">
                <Upload className="w-12 h-12 text-slate-600" />
                <p className="text-sm text-slate-500">Click to ingest PDF or Text files</p>
                <input type="file" onChange={handleFileIngest} className="absolute inset-0 opacity-0 cursor-pointer" />
             </div>
          </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex-1">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Book className="w-5 h-5 text-indigo-400" /> Existing Documents</h2>
        {documents.length === 0 ? <p className="text-slate-500 italic">No documents in long-term memory.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc, i) => (
                    <div key={i} className="bg-slate-800 p-4 rounded border border-slate-700 flex items-center gap-3">
                        <FileText className="w-8 h-8 text-slate-500" />
                        <span className="font-mono text-sm">{doc}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
