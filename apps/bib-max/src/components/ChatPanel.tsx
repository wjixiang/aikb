import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi } from "@/lib/api/chat";
import type { ChatMessage } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, SendHorizontal, Loader2 } from "lucide-react";
import { ChatMessageView } from "./ChatMessage";

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load history when panel opens
  useEffect(() => {
    if (!isOpen) return;
    chatApi.getHistory()
      .then((res) => setMessages(res.messages))
      .catch(() => {});
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

    try {
      const res = await chatApi.sendMessage(text);
      // Reload full history to get properly formatted messages
      const history = await chatApi.getHistory();
      setMessages(history.messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      // Remove optimistic user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle button — visible when panel is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex h-10 w-10 items-center justify-center rounded-full border bg-card shadow-md transition-colors hover:bg-accent"
          title="Open AI Assistant"
        >
          <MessageSquare className="size-5" />
        </button>
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l bg-card shadow-xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Ask me anything about your bibliography.
            </p>
          )}
          {messages.map((msg, i) => (
            <ChatMessageView key={i} message={msg} />
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
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
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
