import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  type: "user" | "ai" | "system" | "status";
  content: string;
  data?: any;
  timestamp: string;
}

export interface UseSimpleChat {
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading: boolean;
  sessionId: string;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  connect: (sessionId?: string) => void;
  disconnect: () => void;
}

export const useSimpleChat = (): UseSimpleChat => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback((customSessionId?: string) => {
    const newSessionId =
      customSessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);

    // Load existing messages if session exists
    if (customSessionId) {
      fetch(`/api/chat/stream?sessionId=${customSessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) {
            setMessages(data.messages);
          }
        })
        .catch(console.error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId || isLoading) return;

      setIsLoading(true);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            message,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        // Create EventSource for streaming response
        const eventSource = new EventSource(
          `/api/chat/stream?sessionId=${sessionId}`,
        );
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case "connected":
                setIsConnected(true);
                break;
              case "user":
              case "ai":
              case "system":
              case "status":
                setMessages((prev) => [
                  ...prev,
                  {
                    id:
                      data.id ||
                      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: data.type,
                    content: data.content,
                    data: data.data,
                    timestamp: data.timestamp || new Date().toISOString(),
                  },
                ]);
                break;
              case "done":
                setIsLoading(false);
                eventSource.close();
                setIsConnected(false);
                break;
              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg_${Date.now()}`,
                    type: "system",
                    content: `错误: ${data.content}`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                setIsLoading(false);
                eventSource.close();
                setIsConnected(false);
                break;
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          console.error("EventSource error");
          setIsLoading(false);
          setIsConnected(false);
          eventSource.close();
        };
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            type: "system",
            content: `发送失败: ${error instanceof Error ? error.message : "未知错误"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
      }
    },
    [sessionId, isLoading],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    if (sessionId) {
      // Clear session on backend
      fetch(`/api/chat/stream?sessionId=${sessionId}`, {
        method: "DELETE",
      }).catch(console.error);
    }
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [disconnect]);

  return {
    messages,
    isConnected,
    isLoading,
    sessionId,
    sendMessage,
    clearChat,
    connect,
    disconnect,
  };
};
