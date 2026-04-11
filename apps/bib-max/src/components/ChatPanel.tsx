import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { chatApi, sendMessageStream } from "@/lib/api/chat";
import type { ChatMessage, UserContext, ToolStartedEvent, ToolCompletedEvent } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, SendHorizontal, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChatMessage as ChatMessageItem } from "./ChatMessage";
import { useIsMobile } from "@/hooks/use-mobile";

export function ChatPanel() {
  const location = useLocation();
  const params = useParams<{ itemId?: string; attId?: string }>();
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState("");
  const [pendingToolCalls, setPendingToolCalls] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const getUserContext = useCallback((): UserContext | undefined => {
    const { pathname } = location;
    if (pathname.startsWith('/items/') && params.itemId) {
      return { route: pathname, itemId: params.itemId, attId: params.attId };
    }
    return { route: pathname };
  }, [location, params.itemId, params.attId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  // Load history when panel opens
  useEffect(() => {
    if (!isOpen) return;
    chatApi.getHistory()
      .then((res) => setMessages(res.messages))
      .catch(() => { });
  }, [isOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const finishTurn = useCallback(() => {
    setStatus('idle');
    cancelRef.current = null;
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || status !== 'idle') return;

    setInput('');
    setError('');
    setStatus('running');

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text }],
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const { cancel } = await sendMessageStream(
      text,
      {
        onMessageAdded: (message) => {
          if (message.role === 'assistant') {
            setMessages((prev) => [...prev, message]);
          }
        },
        onToolStarted: (data: ToolStartedEvent) => {
          setPendingToolCalls((prev) => new Set(prev).add(data.toolName));
        },
        onToolCompleted: (data: ToolCompletedEvent) => {
          setPendingToolCalls((prev) => {
            const next = new Set(prev);
            next.delete(data.toolName);
            return next;
          });
          setMessages((prev) => {
            for (let i = prev.length - 1; i >= 0; i--) {
              const msg = prev[i];
              if (msg.role !== 'assistant') continue;
              const hasToolUse = msg.content.some(
                (b) => b.type === 'tool_use' && (b as { name: string }).name === data.toolName,
              );
              if (!hasToolUse) continue;
              const updatedContent = [
                ...msg.content,
                {
                  type: 'tool_result',
                  toolName: data.toolName,
                  content: typeof data.result === 'string' ? data.result : JSON.stringify(data.result ?? ''),
                  is_error: !data.success,
                },
              ];
              const updated = [...prev];
              updated[i] = { ...msg, content: updatedContent };
              return updated;
            }
            return prev;
          });
        },
        onStatusChange: (data) => {
          if (data.status === 'completed' || data.status === 'aborted') {
            finishTurn();
          }
        },
        onCompleted: (data) => {
          // Agent final output — add as assistant message if no incremental messages arrived
          const output = typeof data === 'string' ? data : (data as { output?: string })?.output ?? JSON.stringify(data);
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            const hasAssistantContent = lastMsg?.role === 'assistant';
            if (hasAssistantContent) return prev;
            return [...prev, {
              role: 'assistant',
              content: [{ type: 'text', text: output }],
              ts: Date.now(),
            }];
          });
        },
        onError: (message) => {
          setError(message);
          finishTurn();
        },
      },
      getUserContext(),
    );

    cancelRef.current = cancel;
  }, [input, status, getUserContext, finishTurn]);

  const handleCancel = () => {
    cancelRef.current?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isRunning = status === 'running';

  const chatContent = (
    <>
      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-3">
          {messages.length === 0 && !isRunning && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Ask me anything about your knowledge base.
            </p>
          )}
          {messages.map((msg, i) => (
            <ChatMessageItem key={i} message={msg} pendingToolCalls={pendingToolCalls} />
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Thinking...
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isRunning}
          />
          <Button
            size="icon-sm"
            onClick={sendMessage}
            disabled={!input.trim() || isRunning}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );

  // Mobile: FAB + Sheet overlay
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="size-6" />
        </button>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-md p-0 flex flex-col gap-0">
            <SheetTitle className="sr-only">AI Assistant</SheetTitle>
            <SheetDescription className="sr-only">Chat with your knowledge base.</SheetDescription>

            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
              <h2 className="text-sm font-semibold">AI Assistant</h2>
              <div className="flex items-center gap-1">
                {isRunning && (
                  <Button variant="ghost" size="icon-sm" onClick={handleCancel} title="Cancel">
                    <Square className="size-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {chatContent}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: inline panel (original behavior)
  return (
    <>
      {/* Collapsed toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="shrink-0 w-10 flex items-center justify-center border-l bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Open AI Assistant"
        >
          <MessageSquare className="size-5" />
        </button>
      )}

      {/* Panel */}
      <div
        className={cn(
          "shrink-0 overflow-hidden border-l bg-card transition-all duration-300 flex flex-col h-full",
          isOpen ? "w-[400px]" : "w-0 border-l-0",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold">AI Assistant</h2>
          <div className="flex items-center gap-1">
            {isRunning && (
              <Button variant="ghost" size="icon-sm" onClick={handleCancel} title="Cancel">
                <Square className="size-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {chatContent}
      </div>
    </>
  );
}
