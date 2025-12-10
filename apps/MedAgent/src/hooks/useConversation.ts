import { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { Message } from '../types/conversation.types';

export const useConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { sendMessage } = useWebSocket();

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const sendMessageToServer = useCallback(
    async (clientMessage: any) => {
      // 添加用户消息到本地状态
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: clientMessage.content,
        timestamp: Date.now(),
      };
      addMessage(userMessage);

      // 发送到服务器
      await sendMessage(clientMessage);
    },
    [sendMessage, addMessage],
  );

  // 监听服务器消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const serverMessage = JSON.parse(event.data);

        if (serverMessage.type === 'stream_chunk') {
          const chunk = serverMessage.chunk;

          if (chunk.type === 'text') {
            const assistantMessage: Message = {
              id: `msg_${Date.now()}`,
              type: 'assistant',
              content: chunk.text,
              timestamp: Date.now(),
            };
            addMessage(assistantMessage);
          }
        }
      } catch (error) {
        console.error('Error handling server message:', error);
      }
    };

    // 这里需要实际的 WebSocket 实例来监听消息
    // 在实际实现中，这会在 useWebSocket 中处理
  }, [addMessage]);

  return { messages, sendMessage: sendMessageToServer, addMessage };
};
