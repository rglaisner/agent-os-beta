import React from 'react';
import MissionControl from '../components/MissionControl';
import AgentCard from '../components/AgentCard';
import { useStore } from '../store';
import { DEFAULT_TOOLS } from '../constants';
import { Plus } from 'lucide-react';

const SetupPage = () => {
  const { agents, addAgent, updateAgent, removeAgent, addNewAgents, runOrchestratedSimulation, isRunning } = useStore();

  return (
    <main className="container mx-auto p-4 flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
      <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto">
        <div className="flex justify-between items-center px-1">
          <h2 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Agents</h2>
          <button onClick={addAgent} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"><Plus className="w-4 h-4" /></button>
        </div>
        {agents.map(a => <AgentCard key={a.id} agent={a} availableTools={DEFAULT_TOOLS} onUpdate={updateAgent} onRemove={removeAgent} />)}
      </div>
      <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
        <MissionControl agents={agents} onLaunch={runOrchestratedSimulation} isRunning={isRunning} onAddAgents={addNewAgents} onUpdateAgent={updateAgent} />
      </div>
    </main>
  );
};

export default SetupPage;
