'use client';

import React, { useState } from 'react';
import { SimpleChat } from '@/components/SimpleChat';
import { chatBackendServiceClient } from '@/lib/services/ChatBackendService.client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ChatDemoPage() {
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [backendMessage, setBackendMessage] = useState('');
  const [isBackendSending, setIsBackendSending] = useState(false);

  const handleSessionCreate = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleBackendSend = async () => {
    if (!backendMessage.trim() || !currentSessionId) {
      toast.error('Please enter a message and ensure a chat session is active');
      return;
    }

    setIsBackendSending(true);
    try {
      await chatBackendServiceClient.pushMessage(currentSessionId, {
        type: 'ai',
        content: backendMessage,
      });
      setBackendMessage('');
      toast.success('Message sent from backend');
    } catch (error) {
      toast.error('Failed to send message from backend');
    } finally {
      setIsBackendSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!currentSessionId) {
      toast.error('Please start a chat session first');
      return;
    }

    setIsBackendSending(true);
    try {
      await chatBackendServiceClient.startConversation(
        currentSessionId,
        "Hello! I'm starting this conversation from the backend. How can I help you today?",
      );

      // Simulate multi-round conversation
      setTimeout(async () => {
        await chatBackendServiceClient.continueConversation(
          currentSessionId,
          'Let me tell you more about what I can do...',
        );
      }, 2000);

      setTimeout(async () => {
        await chatBackendServiceClient.completeConversation(
          currentSessionId,
          'I hope this demonstration was helpful!',
        );
      }, 4000);
    } catch (error) {
      toast.error('Failed to start conversation');
    } finally {
      setIsBackendSending(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Simplified Chat System Demo</h1>
        <p className="text-muted-foreground">
          This demonstrates the new simplified chat system with
          backend-initiated conversations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chat Interface */}
        <div>
          <SimpleChat
            onSessionCreate={handleSessionCreate}
            sessionId={currentSessionId || undefined}
          />
        </div>

        {/* Backend Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Backend Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Session ID:</label>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {currentSessionId || 'No active session'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Send Message from Backend
              </label>
              <Textarea
                value={backendMessage}
                onChange={(e) => setBackendMessage(e.target.value)}
                placeholder="Enter message to send from backend..."
                rows={3}
                disabled={!currentSessionId || isBackendSending}
              />
              <Button
                onClick={handleBackendSend}
                disabled={
                  !backendMessage.trim() ||
                  !currentSessionId ||
                  isBackendSending
                }
                className="w-full"
              >
                Send from Backend
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Multi-round Conversation Demo
              </label>
              <Button
                onClick={handleStartConversation}
                disabled={!currentSessionId || isBackendSending}
                variant="outline"
                className="w-full"
              >
                Start Backend-initiated Conversation
              </Button>
              <p className="text-xs text-muted-foreground">
                This will simulate a multi-round conversation initiated entirely
                from the backend
              </p>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">
                Backend Service Methods:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• pushMessage() - Send single message</li>
                <li>• startConversation() - Start multi-round chat</li>
                <li>• continueConversation() - Continue with next message</li>
                <li>• completeConversation() - End conversation</li>
                <li>• processWithAgent() - Use AI agent for processing</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
