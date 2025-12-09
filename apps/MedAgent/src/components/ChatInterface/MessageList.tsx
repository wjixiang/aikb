import React from 'react';
import { Message } from '../../types/conversation.types';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.type === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.type === 'user'
                ? 'bg-blue-500 text-white'
                : message.type === 'assistant'
                ? 'bg-gray-200 text-gray-800'
                : message.type === 'tool_result'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            <div className="text-sm font-medium mb-1">
              {message.type === 'user' ? 'You' : 
               message.type === 'assistant' ? 'Assistant' :
               message.type === 'tool_result' ? 'Tool Result' : 'System'}
            </div>
            <div className="whitespace-pre-wrap">
              {message.content}
            </div>
            <div className="text-xs mt-1 opacity-70">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};