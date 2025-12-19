import React from 'react';
import { Sparkles, Check, X, Eye } from 'lucide-react';
import { type Agent } from '../constants';

interface SmartAgentSuggestionProps {
  suggestedAgents: Agent[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onReview: () => void;
}

export default function SmartAgentSuggestion({ 
  suggestedAgents, 
  onAcceptAll, 
  onRejectAll, 
  onReview 
}: SmartAgentSuggestionProps) {
  if (!suggestedAgents || suggestedAgents.length === 0) {
    return null;
  }

  return (
    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-4 shadow-lg animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-emerald-100 p-2 rounded-lg">
          <Sparkles className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-emerald-900 text-sm mb-1">Smart Agent Suggestions</h3>
          <p className="text-xs text-emerald-700">
            {suggestedAgents.length} new agent{suggestedAgents.length > 1 ? 's' : ''} suggested for your mission
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAcceptAll}
          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Check className="w-4 h-4" /> Accept All
        </button>
        <button
          onClick={onReview}
          className="flex-1 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-300 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Eye className="w-4 h-4" /> Review
        </button>
        <button
          onClick={onRejectAll}
          className="flex-1 px-4 py-2 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" /> Reject All
        </button>
      </div>
    </div>
  );
}
