import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign, Award, AlertCircle } from 'lucide-react';

interface AnalyticsDashboardProps {
  backendUrl: string;
}

interface SuccessRate {
  agent_type: string;
  success_rate: number;
  total_missions: number;
  successful_missions: number;
}

interface ExecutionTime {
  category: string;
  average_execution_time: number;
  total_missions: number;
}

interface CostTrend {
  date: string;
  cost: number;
}

interface Suggestion {
  type: string;
  message: string;
  priority: string;
}

interface AgentPerformance {
  agent_type: string;
  performance_score: number;
  success_rate: number;
  average_cost: number;
  average_time: number;
}

export default function AnalyticsDashboard({ backendUrl }: AnalyticsDashboardProps) {
  const [successRates, setSuccessRates] = useState<SuccessRate[]>([]);
  const [executionTimes, setExecutionTimes] = useState<ExecutionTime[]>([]);
  const [costTrends, setCostTrends] = useState<CostTrend[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert WebSocket URL to HTTP URL for REST API calls
  const httpUrl = backendUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/ws$/, '')
    .replace(/\/$/, ''); // Remove trailing slash if present

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [successRes, timeRes, costRes, perfRes] = await Promise.all([
        fetch(`${httpUrl}/api/analytics/success-rates`),
        fetch(`${httpUrl}/api/analytics/execution-times`),
        fetch(`${httpUrl}/api/analytics/cost-trends?days=30`),
        fetch(`${httpUrl}/api/analytics/agent-performance`)
      ]);

      const [successData, timeData, costData, perfData] = await Promise.all([
        successRes.json(),
        timeRes.json(),
        costRes.json(),
        perfRes.json()
      ]);

      setSuccessRates(successData.success_rates || []);
      setExecutionTimes(timeData.execution_times || []);
      setCostTrends(costData.daily_costs || []);
      setSuggestions(costData.suggestions || []);
      setAgentPerformance(perfData.rankings || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-indigo-500" />
        <h2 className="text-2xl font-bold text-slate-800">Mission Analytics Dashboard</h2>
      </div>

      {/* Success Rates */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          Success Rate by Agent Type
        </h3>
        <div className="space-y-3">
          {successRates.length === 0 ? (
            <p className="text-slate-400 text-sm">No data available</p>
          ) : (
            successRates.map((rate) => (
              <div key={rate.agent_type} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-700">{rate.agent_type}</span>
                    <span className="text-sm font-bold text-emerald-600">{rate.success_rate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${rate.success_rate}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {rate.successful_missions} / {rate.total_missions} successful
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Execution Times */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Average Execution Time by Category
        </h3>
        <div className="space-y-3">
          {executionTimes.length === 0 ? (
            <p className="text-slate-400 text-sm">No data available</p>
          ) : (
            executionTimes.map((time) => (
              <div key={time.category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="font-medium text-slate-700">{time.category}</span>
                  <div className="text-xs text-slate-500">{time.total_missions} missions</div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-blue-600">{time.average_execution_time}s</span>
                  <div className="text-xs text-slate-500">
                    {time.min_time}s - {time.max_time}s
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cost Trends & Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Cost Trends (30 days)
          </h3>
          {costTrends.length === 0 ? (
            <p className="text-slate-400 text-sm">No cost data available</p>
          ) : (
            <div className="space-y-2">
              {costTrends.slice(-7).map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{trend.date}</span>
                  <span className="font-bold text-amber-600">${trend.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Optimization Suggestions
          </h3>
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-slate-400 text-sm">No suggestions available</p>
            ) : (
              suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    suggestion.priority === 'high'
                      ? 'bg-red-50 border-red-200'
                      : suggestion.priority === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="text-sm text-slate-700">{suggestion.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Agent Performance Rankings */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Agent Performance Rankings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-4 text-sm font-bold text-slate-700">Rank</th>
                <th className="text-left py-2 px-4 text-sm font-bold text-slate-700">Agent Type</th>
                <th className="text-right py-2 px-4 text-sm font-bold text-slate-700">Performance</th>
                <th className="text-right py-2 px-4 text-sm font-bold text-slate-700">Success Rate</th>
                <th className="text-right py-2 px-4 text-sm font-bold text-slate-700">Avg Cost</th>
                <th className="text-right py-2 px-4 text-sm font-bold text-slate-700">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                    No performance data available
                  </td>
                </tr>
              ) : (
                agentPerformance.map((agent, idx) => (
                  <tr key={agent.agent_type} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-bold text-slate-600">#{idx + 1}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">{agent.agent_type}</td>
                    <td className="py-3 px-4 text-sm text-right font-bold text-purple-600">
                      {agent.performance_score.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-emerald-600">
                      {agent.success_rate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-amber-600">
                      ${agent.average_cost.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-blue-600">
                      {agent.average_time.toFixed(1)}s
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
