import { useState, useEffect, useCallback } from 'react';
import { ClientMessage, ServerMessage } from '../types/conversation.types';

const WS_URL =
  process.env.NODE_ENV === 'production'
    ? 'wss://your-domain.com/ws'
    : 'ws://localhost:3001/ws';

export const useWebSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setSocket(ws);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback(
    (message: ClientMessage) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        console.warn('WebSocket not ready, message not sent:', message);
      }
    },
    [socket],
  );

  return { socket, isConnected, sendMessage };
};
