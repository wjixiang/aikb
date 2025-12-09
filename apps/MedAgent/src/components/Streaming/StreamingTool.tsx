import React, { useState, useEffect } from 'react';
import { ToolCall } from '../ToolExecution/ToolCall';
import { ToolResult } from '../ToolExecution/ToolResult';

interface StreamingToolProps {
  toolName: string;
  parameters: Record<string, any>;
  toolCallId: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
}

export const StreamingTool: React.FC<StreamingToolProps> = ({
  toolName,
  parameters,
  toolCallId,
  status,
  result,
  error,
  timestamp
}) => {
  const [currentStatus, setCurrentStatus] = useState(status);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const showResult = status === 'completed' || status === 'error';

  return (
    <div className="space-y-2">
      <ToolCall
        toolName={toolName}
        parameters={parameters}
        toolCallId={toolCallId}
        timestamp={timestamp}
        status={currentStatus}
      />
      
      {showResult && (
        <ToolResult
          toolName={toolName}
          result={result}
          toolCallId={toolCallId}
          timestamp={timestamp}
          success={status === 'completed'}
          error={error}
        />
      )}
    </div>
  );
};