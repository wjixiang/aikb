import React, { useState } from 'react';

interface ToolResultProps {
  toolName: string;
  result: any;
  toolCallId: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

export const ToolResult: React.FC<ToolResultProps> = ({
  toolName,
  result,
  toolCallId,
  timestamp,
  success,
  error
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatResult = (data: any): string => {
    if (typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, null, 2);
  };

  const getResultPreview = (data: any): string => {
    const formatted = formatResult(data);
    if (formatted.length <= 100) {
      return formatted;
    }
    return formatted.substring(0, 100) + '...';
  };

  return (
    <div className={`border rounded-lg p-3 mb-2 ${
      success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{success ? '✅' : '❌'}</span>
          <span className="font-medium text-sm">
            {success ? 'Tool Result' : 'Tool Error'}: {toolName}
          </span>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {success ? 'Success' : 'Failed'}
        </div>
      </div>
      
      <div className="text-xs text-gray-600 mb-2">
        ID: {toolCallId} • {new Date(timestamp).toLocaleTimeString()}
      </div>
      
      {error ? (
        <div className="bg-red-100 border border-red-200 rounded p-2 mb-2">
          <div className="text-xs font-medium text-red-700 mb-1">Error:</div>
          <div className="text-xs text-red-600">{error}</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-gray-700">Result:</div>
            {formatResult(result).length > 100 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
          <pre className={`text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap ${
            isExpanded ? '' : 'max-h-20 overflow-hidden'
          }`}>
            {isExpanded ? formatResult(result) : getResultPreview(result)}
          </pre>
        </div>
      )}
    </div>
  );
};