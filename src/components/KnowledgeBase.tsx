import React, { useState, useEffect, useCallback } from 'react';
import { Book, Upload, Loader, Trash2, Search, File as FileIcon, Plus } from 'lucide-react';

interface KnowledgeBaseProps {
  backendUrl: string;
}

export default function KnowledgeBase({ backendUrl }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadSource, setUploadSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const httpUrl = backendUrl.replace('ws://', 'http://').replace('/ws', '');

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${httpUrl}/api/knowledge`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch (e) {
      console.error(e);
    }
  }, [httpUrl]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async () => {
    if (!uploadText || !uploadSource) return;
    setLoading(true);
    setUploadProgress(10);
    const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 10 : prev));
    }, 200);

    try {
      await fetch(`${httpUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: uploadText, source: uploadSource })
      });
      setUploadProgress(100);
      setTimeout(() => {
          setUploadText('');
          setUploadSource('');
          setUploadProgress(0);
          setShowManualEntry(false);
      }, 500);
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert('Error uploading');
      setUploadProgress(0);
    }
    clearInterval(interval);
    setLoading(false);
  };

  const handleFileIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      setLoading(true);
      setUploadProgress(10);
       const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 5 : prev));
      }, 100);

      const fd = new FormData();
      fd.append("file", e.target.files[0]);
      try {
          await fetch(`${httpUrl}/api/knowledge/upload`, { method: 'POST', body: fd });
          setUploadProgress(100);
          setTimeout(() => setUploadProgress(0), 500);
          fetchDocs();
      } catch (e) {
        console.error(e);
        alert("Upload failed");
        setUploadProgress(0);
      }
      clearInterval(interval);
      setLoading(false);
  };

  const handleDelete = async (docName: string) => {
      if (!confirm(`Are you sure you want to delete "${docName}"?`)) return;
      try {
          await fetch(`${httpUrl}/api/knowledge/${docName}`, { method: 'DELETE' });
          fetchDocs();
      } catch (e) {
          console.error(e);
          alert('Failed to delete document');
      }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6 p-6 overflow-hidden bg-slate-950 text-slate-200">

      {/* LEFT COLUMN: Upload Zone */}
      <div className="w-1/3 flex flex-col gap-6">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl flex-1 flex flex-col">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            Add Knowledge
          </h2>

          <div className="flex-1 flex flex-col gap-6">
            {/* Drag & Drop Area */}
            <div className="relative group border-2 border-dashed border-slate-700 rounded-xl p-8 hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 cursor-pointer">
               <div className="p-4 bg-slate-800 rounded-full group-hover:scale-110 transition-transform">
                   <Upload className="w-8 h-8 text-indigo-400" />
               </div>
               <div>
                   <p className="font-semibold text-white">Click or Drag file here</p>
                   <p className="text-sm text-slate-500 mt-1">PDF or Text files supported</p>
               </div>
               <input
                 type="file"
                 onChange={handleFileIngest}
                 className="absolute inset-0 opacity-0 cursor-pointer"
                 accept=".pdf,.txt,.md,.py,.js"
               />

               {loading && uploadProgress > 0 && (
                   <div className="absolute inset-x-6 bottom-6">
                       <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                           <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                       </div>
                   </div>
               )}
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-900/50 text-slate-500">Or</span>
                </div>
            </div>

            {/* Manual Entry Toggle */}
             <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
             >
                <Plus className="w-4 h-4" />
                {showManualEntry ? 'Cancel Manual Entry' : 'Enter Text Manually'}
             </button>

            {/* Manual Entry Form */}
            {showManualEntry && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <input
                        className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="Source Name (e.g. 'Meeting Notes')"
                        value={uploadSource}
                        onChange={e => setUploadSource(e.target.value)}
                    />
                    <textarea
                        className="bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm h-32 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Paste content here..."
                        value={uploadText}
                        onChange={e => setUploadText(e.target.value)}
                    />
                    <button
                        onClick={handleUpload}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Book className="w-4 h-4" />}
                        Save to Memory
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Library */}
      <div className="w-2/3 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Book className="w-5 h-5 text-emerald-400" />
                </div>
                Knowledge Library
            </h2>
            <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Filter documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                />
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
            {documents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <Book className="w-16 h-16 mb-4 stroke-1" />
                    <p>No documents found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocuments.map((doc, i) => (
                        <div key={i} className="group bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-4 transition-all duration-200 flex flex-col gap-3 relative">
                            <div className="flex items-start justify-between">
                                <div className="p-2 bg-slate-900 rounded-lg">
                                    <FileIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <button
                                    onClick={() => handleDelete(doc)}
                                    className="p-2 hover:bg-red-500/20 hover:text-red-400 text-slate-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Document"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-200 truncate" title={doc}>{doc}</h3>
                                <p className="text-xs text-slate-500 mt-1">Ready for retrieval</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

    </div>
  );
}
