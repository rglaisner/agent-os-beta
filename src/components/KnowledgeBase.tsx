import React, { useState, useEffect, useCallback } from 'react';
import { Book, Upload, FileText, Loader, Search, Sparkles, Network, Activity, FileCheck } from 'lucide-react';

interface KnowledgeBaseProps {
  backendUrl: string;
}

export default function KnowledgeBase({ backendUrl }: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadSource, setUploadSource] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [semanticResults, setSemanticResults] = useState<any[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<any>(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState<any>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');

  const httpUrl = backendUrl.replace('ws://', 'http://').replace('/ws', '');

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${httpUrl}/api/knowledge`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch {
      // Ignored
    }
  }, [httpUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async () => {
    if (!uploadText || !uploadSource) return;
    setLoading(true);

    try {
      const res = await fetch(`${httpUrl}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: uploadText, source: uploadSource })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      setUploadText('');
      setUploadSource('');
      fetchDocs();
    } catch (e: any) {
      alert(`Error uploading: ${e.message}`);
    }
    setLoading(false);
  };

  const ingestFile = async (file: File) => {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
          const res = await fetch(`${httpUrl}/api/knowledge/upload`, { method: 'POST', body: fd });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Upload failed');
          }
          fetchDocs();
      } catch (e: any) {
        console.error(e);
        alert(`Upload failed: ${e.message}`);
      }
      setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          ingestFile(e.target.files[0]);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          ingestFile(e.dataTransfer.files[0]);
      }
  };

  const handleDelete = async (docName: string) => {
    if (!confirm(`Are you sure you want to delete ${docName}?`)) return;
    try {
      await fetch(`${httpUrl}/api/knowledge/${docName}`, { method: 'DELETE' });
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert('Error deleting document');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${httpUrl}/api/knowledge/search/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setSemanticResults(data.results || []);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchHealthMetrics = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/knowledge/health`);
      const data = await res.json();
      setHealthMetrics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchKnowledgeGraph = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/knowledge/graph`);
      const data = await res.json();
      setKnowledgeGraph(data);
    } catch (e) {
      console.error(e);
    }
  };

  const summarizeDocument = async (docName: string) => {
    setLoading(true);
    try {
      // Get document content first (simplified - would need to fetch actual content)
      const res = await fetch(`${httpUrl}/api/knowledge/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Document: ${docName}`, source: docName })
      });
      const data = await res.json();
      setSummary(data.summary || '');
      setSelectedDoc(docName);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealthMetrics();
    fetchKnowledgeGraph();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full p-1 overflow-y-auto">
      {/* LEFT COLUMN: Upload & Manual Entry */}
      <div className="flex flex-col gap-5">
        {/* Upload Zone */}
        <div
          className={`bg-white p-5 rounded-xl border-2 border-dashed shadow-sm flex flex-col transition-colors relative group
            ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
             <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Upload className="w-4 h-4 text-indigo-500" /> Upload Document</h2>
             <div className="flex flex-col gap-4 h-full justify-center items-center p-6">
                <div className="bg-indigo-50 p-4 rounded-full group-hover:bg-indigo-100 transition-colors">
                    <Upload className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">Drag & Drop or Click to Upload</p>
                    <p className="text-xs text-slate-400 mt-1">PDFs and Text files supported</p>
                </div>
                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
             </div>
        </div>

        {/* Manual Entry */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
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
      </div>

      {/* RIGHT COLUMN: Document Library */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 uppercase tracking-wider"><Book className="w-4 h-4 text-indigo-500" /> Knowledge Base</h2>
        </div>

        {/* Search Bar */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSemanticSearch()}
            />
          </div>
          <button
            onClick={handleSemanticSearch}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Semantic Search
          </button>
        </div>

        {/* Health Metrics */}
        {healthMetrics && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-xs text-slate-700">Knowledge Base Health</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Documents:</span>
                <span className="font-bold ml-1">{healthMetrics.total_documents || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Coverage:</span>
                <span className="font-bold ml-1">{healthMetrics.coverage_score || 0}%</span>
              </div>
              <div>
                <span className="text-slate-500">Chunks:</span>
                <span className="font-bold ml-1">{healthMetrics.total_chunks || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ml-1 ${
                  healthMetrics.health_status === 'good' ? 'text-emerald-600' : 'text-orange-600'
                }`}>
                  {healthMetrics.health_status || 'unknown'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Semantic Search Results */}
        {semanticResults.length > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="font-bold text-xs text-indigo-900">Semantic Search Results</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {semanticResults.map((result, idx) => (
                <div key={idx} className="text-xs bg-white p-2 rounded border border-indigo-100">
                  <div className="font-medium text-slate-700">{result.metadata?.source || 'Unknown'}</div>
                  <div className="text-slate-600 mt-1 line-clamp-2">{result.content}</div>
                  <div className="text-slate-400 mt-1">Score: {(1 - result.score).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
            {documents.length === 0 ? (
                <p className="text-slate-400 italic text-sm border-2 border-dashed border-slate-100 p-8 text-center rounded-lg h-full flex items-center justify-center">
                    No documents in long-term memory.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {filteredDocuments.length === 0 ? (
                         <p className="text-slate-400 italic text-sm text-center py-4">No matching documents found.</p>
                    ) : (
                        filteredDocuments.map((doc, i) => (
                            <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-3 hover:border-indigo-200 hover:shadow-sm transition-all group">
                                <div className="bg-white p-2 rounded border border-slate-100 group-hover:border-indigo-100">
                                    <FileText className="w-5 h-5 text-indigo-500" />
                                </div>
                                <span className="font-medium text-sm text-slate-700 truncate flex-1">{doc}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => summarizeDocument(doc)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-opacity"
                                    title="Summarize"
                                  >
                                    <FileCheck className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDelete(doc)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                  </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Summary Modal */}
      {selectedDoc && summary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setSelectedDoc(null); setSummary(''); }}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Summary: {selectedDoc}</h3>
              <button onClick={() => { setSelectedDoc(null); setSummary(''); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-slate-700 whitespace-pre-wrap">{summary}</p>
          </div>
        </div>
      )}

      {/* Knowledge Graph */}
      {knowledgeGraph && knowledgeGraph.nodes && knowledgeGraph.nodes.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-lg text-slate-800">Knowledge Graph</h3>
          </div>
          <div className="text-sm text-slate-600">
            <p>Total Nodes: {knowledgeGraph.total_nodes}</p>
            <p className="text-xs text-slate-400 mt-2">Graph visualization would be rendered here (requires graph library)</p>
          </div>
        </div>
      )}
    </div>
  );
}
