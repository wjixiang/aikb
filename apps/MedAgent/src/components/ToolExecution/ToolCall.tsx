import React from 'react';

interface ToolCallProps {
  toolName: string;
  parameters: Record<string, any>;
  toolCallId: string;
  timestamp: number;
  status?: 'pending' | 'executing' | 'completed' | 'error';
}

export const ToolCall: React.FC<ToolCallProps> = ({
  toolName,
  parameters,
  toolCallId,
  timestamp,
  status = 'pending'
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'executing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'executing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <span className="font-medium text-sm">Tool: {toolName}</span>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {status}
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mb-2">
        ID: {toolCallId} • {new Date(timestamp).toLocaleTimeString()}
      </div>
      
      {Object.keys(parameters).length > 0 && (
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs font-medium text-gray-700 mb-1">Parameters:</div>
          <pre className="text-xs text-gray-600 overflow-x-auto">
            {JSON.stringify(parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};