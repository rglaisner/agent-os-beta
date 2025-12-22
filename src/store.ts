import create from 'zustand';
import { Agent, PlanStep, DEFAULT_AGENTS } from './constants';
import { produce } from 'immer';

export interface LogEntry {
    timestamp: string;
    agentName: string;
    type: string;
    content: any;
    requestId?: string;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
}

interface AppState {
  agents: Agent[];
  logs: LogEntry[];
  isRunning: boolean;
  usage: TokenUsage;
  finalOutput: string | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
  backendUrl: string;

  addAgent: () => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  addNewAgents: (newAgents: Agent[]) => void;

  runOrchestratedSimulation: (plan: PlanStep[], files: string[], processType: 'sequential' | 'hierarchical') => void;
  stopSimulation: () => void;
  handleHumanResponse: (requestId: string, content: any) => void;
}

export const useStore = create<AppState>((set, get) => ({
  agents: DEFAULT_AGENTS.filter(a => a.type !== 'SYSTEM'),
  logs: [],
  isRunning: false,
  usage: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
  finalOutput: null,
  wsRef: { current: null },
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'ws://localhost:8000/ws',

  addAgent: () => set(produce(draft => {
    draft.agents.push({ id: `agent-${Date.now()}`, role: 'New Agent', goal: 'Help', backstory: 'I help.', toolIds: [], humanInput: false, name: 'New Agent', type: 'CUSTOM' });
  })),

  updateAgent: (id, updates) => set(produce(draft => {
    const agent = draft.agents.find(a => a.id === id);
    if (agent) Object.assign(agent, updates);
  })),

  removeAgent: (id) => set(produce(draft => {
    draft.agents = draft.agents.filter(a => a.id !== id);
  })),

  addNewAgents: (newAgents) => set(produce(draft => {
    const existingIds = new Set(draft.agents.map(a => a.id));
    const uniqueNewAgents = newAgents.filter(a => !existingIds.has(a.id));
    draft.agents.push(...uniqueNewAgents);
  })),

  runOrchestratedSimulation: (plan, files, processType) => {
    const { backendUrl, agents, wsRef } = get();
    set({ isRunning: true, logs: [], finalOutput: null, usage: { inputTokens: 0, outputTokens: 0, totalCost: 0 } });

    try {
      const ws = new WebSocket(backendUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "START_MISSION", payload: { agents, plan, files, processType } }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'USAGE') {
          set({ usage: data.content });
          return;
        }

        if (data.type === 'OUTPUT' && data.agentName === 'System') {
          set({ finalOutput: data.content });
        }

        set(produce(draft => {
          if (data.type === 'STREAM') {
            const last = draft.logs[draft.logs.length - 1];
            if (last && (last.type === 'THOUGHT' || last.type === 'STREAM') && last.agentName === data.agentName) {
              last.content += data.content;
              last.type = 'THOUGHT';
            } else {
              draft.logs.push({ timestamp: new Date().toISOString(), agentName: data.agentName || 'System', type: 'THOUGHT', content: data.content });
            }
          } else {
            draft.logs.push({ timestamp: new Date().toISOString(), agentName: data.agentName || 'System', type: data.type, content: data.content, requestId: data.requestId });
          }
        }));
      };

      ws.onclose = () => set({ isRunning: false });
      ws.onerror = (err) => {
        console.error(err);
        set({ isRunning: false });
      };
    } catch (e) {
      console.error(e);
      set({ isRunning: false });
    }
  },

  stopSimulation: () => {
    const { wsRef } = get();
    if (wsRef.current) {
      wsRef.current.close();
    }
    set({ isRunning: false });
  },

  handleHumanResponse: (requestId, content) => {
    const { wsRef } = get();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "HUMAN_RESPONSE", requestId, content }));
      set(produce(draft => {
        draft.logs.push({
          timestamp: new Date().toISOString(),
          agentName: 'System',
          type: 'SYSTEM',
          content: `User intervention: ${content.action}`
        });
      }));
    }
  },
}));
