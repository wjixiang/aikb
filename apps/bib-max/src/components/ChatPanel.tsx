import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { chatApi, sendMessageStream } from "@/lib/api/chat";
import type { ChatMessage, UserContext, ToolStartedEvent, ToolCompletedEvent } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, SendHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage as ChatMessageItem } from "./ChatMessage";

export function ChatPanel() {
  const location = useLocation();
  const params = useParams<{ itemId?: string; attId?: string }>();
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingToolCalls, setPendingToolCalls] = useState<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, [messages, isLoading]);

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError('');
    setIsLoading(true);

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: [{ type: 'text', text }],
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await sendMessageStream(
      text,
      {
        onStarted: () => {
          // Agent is processing — loading state already set
        },
        onMessageAdded: (message) => {
          // Incrementally render assistant messages as they're added to memory
          if (message.role === 'assistant') {
            setMessages((prev) => [...prev, message]);
          }
        },
        onToolStarted: (data: ToolStartedEvent) => {
          // Track tool IDs that are in progress (for loading indicator)
          setPendingToolCalls((prev) => new Set(prev).add(data.toolName));
        },
        onToolCompleted: (data: ToolCompletedEvent) => {
          // Remove from pending, then merge result into the matching assistant message
          setPendingToolCalls((prev) => {
            const next = new Set(prev);
            next.delete(data.toolName);
            return next;
          });
          setMessages((prev) => {
            // Find the most recent assistant message that has a tool_use block with this name
            for (let i = prev.length - 1; i >= 0; i--) {
              const msg = prev[i];
              if (msg.role !== 'assistant') continue;
              const hasToolUse = msg.content.some(
                (b) => b.type === 'tool_use' && (b as { name: string }).name === data.toolName,
              );
              if (!hasToolUse) continue;
              // Append a tool_result block to this message's content
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
        onCompleted: (data) => {
          // If no incremental messages arrived, fall back to final result
          const output = typeof data === 'string' ? data : (data as { output?: string })?.output ?? JSON.stringify(data);
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            const hasAssistantContent = lastMsg?.role === 'assistant';
            if (hasAssistantContent) return prev; // Already rendered incrementally
            return [...prev, {
              role: 'assistant',
              content: [{ type: 'text', text: output }],
              ts: Date.now(),
            }];
          });
        },
        onError: (message) => {
          setError(message);
          setMessages((prev) => prev.slice(0, -1));
        },
      },
      getUserContext(),
    );

    setIsLoading(false);
  }, [input, isLoading, getUserContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-3">
            {messages.length === 0 && !isLoading && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Ask me anything about your knowledge base.
              </p>
            )}
            {messages.map((msg, i) => (
              <ChatMessageItem key={i} message={msg} pendingToolCalls={pendingToolCalls} />
            ))}
            {isLoading && (
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
              disabled={isLoading}
            />
            <Button
              size="icon-sm"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
            >
              <SendHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
