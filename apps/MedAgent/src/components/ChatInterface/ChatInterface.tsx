import React, { useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useConversation } from '../../hooks/useConversation';

export const ChatInterface: React.FC = () => {
  const { messages, sendMessage } = useConversation();
  const { isConnected } = useWebSocket();
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(() => 
    `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const handleSubmit = useCallback(async (content: string) => {
    if (!content.trim() || !isConnected) return;

    await sendMessage({
      type: 'user_input',
      conversationId,
      content: content.trim()
    });
    
    setInput('');
  }, [conversationId, sendMessage, isConnected]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>
      
      <div className="border-t border-gray-200 p-4">
        <MessageInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={!isConnected}
          placeholder="输入消息..."
        />
      </div>
    </div>
  );
};