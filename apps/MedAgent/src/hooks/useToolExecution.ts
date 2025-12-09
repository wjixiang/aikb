import { useState, useCallback } from 'react';

interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
}

export const useToolExecution = () => {
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);

  const startToolExecution = useCallback((
    toolName: string,
    parameters: Record<string, any>,
    toolCallId: string
  ) => {
    const execution: ToolExecution = {
      id: toolCallId,
      toolName,
      parameters,
      status: 'pending',
      timestamp: Date.now()
    };

    setToolExecutions(prev => [...prev, execution]);
    return execution.id;
  }, []);

  const updateToolStatus = useCallback((
    toolCallId: string,
    status: ToolExecution['status'],
    result?: any,
    error?: string
  ) => {
    setToolExecutions(prev => 
      prev.map(execution => 
        execution.id === toolCallId
          ? { ...execution, status, result, error }
          : execution
      )
    );
  }, []);

  const completeToolExecution = useCallback((
    toolCallId: string,
    result: any
  ) => {
    updateToolStatus(toolCallId, 'completed', result);
  }, [updateToolStatus]);

  const failToolExecution = useCallback((
    toolCallId: string,
    error: string
  ) => {
    updateToolStatus(toolCallId, 'error', undefined, error);
  }, [updateToolStatus]);

  const clearExecutions = useCallback(() => {
    setToolExecutions([]);
  }, []);

  const getExecutionById = useCallback((toolCallId: string) => {
    return toolExecutions.find(execution => execution.id === toolCallId);
  }, [toolExecutions]);

  const getActiveExecutions = useCallback(() => {
    return toolExecutions.filter(execution => 
      execution.status === 'pending' || execution.status === 'executing'
    );
  }, [toolExecutions]);

  return {
    toolExecutions,
    startToolExecution,
    completeToolExecution,
    failToolExecution,
    updateToolStatus,
    clearExecutions,
    getExecutionById,
    getActiveExecutions
  };
};