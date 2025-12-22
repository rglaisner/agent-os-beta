import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Power, Webhook } from 'lucide-react';

interface SchedulingProps {
  backendUrl: string;
}

export default function Scheduling({ backendUrl }: SchedulingProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    schedule_type: 'DAILY',
    schedule_config: JSON.stringify({ hour: 9, minute: 0 }, null, 2),
    webhook_url: ''
  });

  // Convert WebSocket URL to HTTP URL for REST API calls
  const httpUrl = backendUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://')
    .replace(/\/ws$/, '')
    .replace(/\/$/, ''); // Remove trailing slash if present

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/scheduling/list?active_only=false`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${httpUrl}/api/scheduling/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          plan: [],
          agents: [],
          schedule_config: JSON.parse(formData.schedule_config)
        })
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: '', goal: '', schedule_type: 'DAILY', schedule_config: JSON.stringify({ hour: 9, minute: 0 }, null, 2), webhook_url: '' });
        fetchSchedules();
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Failed to create schedule');
    }
  };

  const handleToggle = async (scheduleId: number) => {
    try {
      await fetch(`${httpUrl}/api/scheduling/${scheduleId}/toggle`, { method: 'POST' });
      fetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const handleDelete = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await fetch(`${httpUrl}/api/scheduling/${scheduleId}`, { method: 'DELETE' });
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-indigo-500" />
          <h2 className="text-2xl font-bold text-slate-800">Mission Scheduling & Automation</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4">Create Scheduled Mission</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="Daily Report"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Goal</label>
              <textarea
                value={formData.goal}
                onChange={e => setFormData({ ...formData, goal: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                rows={3}
                placeholder="Mission goal..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Type</label>
              <select
                value={formData.schedule_type}
                onChange={e => setFormData({ ...formData, schedule_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="ONCE">Once</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="WEBHOOK">Webhook</option>
              </select>
            </div>
            {formData.schedule_type === 'WEBHOOK' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={formData.webhook_url}
                  onChange={e => setFormData({ ...formData, webhook_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="https://example.com/webhook"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Config (JSON)</label>
              <textarea
                value={formData.schedule_config}
                onChange={e => setFormData({ ...formData, schedule_config: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-sm"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {schedules.map(schedule => (
          <div key={schedule.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-slate-800">{schedule.name}</h3>
                  {schedule.schedule_type === 'WEBHOOK' && <Webhook className="w-4 h-4 text-blue-500" />}
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    schedule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {schedule.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-2">{schedule.goal}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {schedule.schedule_type}
                  </div>
                  {schedule.next_run && (
                    <div>Next: {new Date(schedule.next_run).toLocaleString()}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(schedule.id)}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                  title={schedule.is_active ? 'Deactivate' : 'Activate'}
                >
                  <Power className={`w-4 h-4 ${schedule.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="p-2 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
