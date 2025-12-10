import { create } from 'zustand';

export interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
  conversationId: string;
}

interface ToolState {
  executions: ToolExecution[];
  availableTools: string[];
  isLoading: boolean;
  error: string | null;
}

interface ToolActions {
  startExecution: (
    toolName: string,
    parameters: Record<string, any>,
    toolCallId: string,
    conversationId: string,
  ) => void;
  updateExecution: (
    toolCallId: string,
    status: ToolExecution['status'],
    result?: any,
    error?: string,
  ) => void;
  completeExecution: (toolCallId: string, result: any) => void;
  failExecution: (toolCallId: string, error: string) => void;
  clearExecutions: () => void;
  clearExecutionsForConversation: (conversationId: string) => void;
  setAvailableTools: (tools: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getExecutionById: (toolCallId: string) => ToolExecution | undefined;
  getExecutionsForConversation: (conversationId: string) => ToolExecution[];
  getActiveExecutions: () => ToolExecution[];
}

export const useToolStore = create<ToolState & ToolActions>((set, get) => ({
  // Initial state
  executions: [],
  availableTools: [],
  isLoading: false,
  error: null,

  // Actions
  startExecution: (toolName, parameters, toolCallId, conversationId) => {
    const execution: ToolExecution = {
      id: toolCallId,
      toolName,
      parameters,
      status: 'pending',
      timestamp: Date.now(),
      conversationId,
    };

    set((state) => ({
      executions: [...state.executions, execution],
    }));
  },

  updateExecution: (toolCallId, status, result, error) => {
    set((state) => ({
      executions: state.executions.map((execution) =>
        execution.id === toolCallId
          ? { ...execution, status, result, error }
          : execution,
      ),
    }));
  },

  completeExecution: (toolCallId, result) => {
    get().updateExecution(toolCallId, 'completed', result);
  },

  failExecution: (toolCallId, error) => {
    get().updateExecution(toolCallId, 'error', undefined, error);
  },

  clearExecutions: () => {
    set({ executions: [] });
  },

  clearExecutionsForConversation: (conversationId) => {
    set((state) => ({
      executions: state.executions.filter(
        (execution) => execution.conversationId !== conversationId,
      ),
    }));
  },

  setAvailableTools: (tools) => {
    set({ availableTools: tools });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  getExecutionById: (toolCallId) => {
    return get().executions.find((execution) => execution.id === toolCallId);
  },

  getExecutionsForConversation: (conversationId) => {
    return get().executions.filter(
      (execution) => execution.conversationId === conversationId,
    );
  },

  getActiveExecutions: () => {
    return get().executions.filter(
      (execution) =>
        execution.status === 'pending' || execution.status === 'executing',
    );
  },
}));
