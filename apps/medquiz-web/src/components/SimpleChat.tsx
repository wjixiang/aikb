'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSimpleChat } from '@/hooks/useSimpleChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleChatProps {
  className?: string;
  sessionId?: string;
  onSessionCreate?: (sessionId: string) => void;
}

export function SimpleChat({
  className,
  sessionId,
  onSessionCreate,
}: SimpleChatProps) {
  const {
    messages,
    isConnected,
    isLoading,
    sessionId: currentSessionId,
    sendMessage,
    clearChat,
    connect,
    disconnect,
  } = useSimpleChat();

  const [inputMessage, setInputMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-connect when sessionId is provided
  useEffect(() => {
    if (sessionId && !currentSessionId) {
      connect(sessionId);
      onSessionCreate?.(sessionId);
    }
  }, [sessionId, currentSessionId, connect, onSessionCreate]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    await sendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConnect = () => {
    connect();
    if (!sessionId) {
      onSessionCreate?.(currentSessionId);
    }
  };

  return (
    <Card className={cn('w-full max-w-2xl mx-auto', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Assistant
        </CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-gray-300',
            )}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!currentSessionId ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <p className="text-muted-foreground">Start a new conversation</p>
            <Button onClick={handleConnect}>
              <Bot className="h-4 w-4 mr-2" />
              Start Chat
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea
              className="h-[400px] border rounded-lg p-4"
              ref={scrollAreaRef}
            >
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Start a conversation by typing a message below
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-3',
                        message.type === 'user'
                          ? 'justify-end'
                          : 'justify-start',
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.type === 'system'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.data && (
                          <div className="mt-2 text-xs opacity-75">
                            {JSON.stringify(message.data, null, 2)}
                          </div>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" />
                        <span>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
