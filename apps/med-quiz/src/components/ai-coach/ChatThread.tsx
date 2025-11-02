import React, { useRef, useEffect, useCallback, memo } from "react";
import { MessageItem } from "./MessageItem";
import { Loader2, Bot, Info, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStickToBottom } from "use-stick-to-bottom";

interface ChatThreadProps {
  messages: any[];
  statusMessages: string[];
  currentAiMessage: any;
  loading: boolean;
  selectedSource: string;
  onRegenerateLastMessage: (source: string) => void;
  showScrollButton: boolean;
  followMode: boolean;
  onEnableFollowMode: () => void;
}

// Memoized component for history messages to prevent re-rendering during streaming
const HistoryMessages = memo(
  ({
    messages,
    statusMessages,
    loading,
    selectedSource,
    onRegenerateLastMessage,
  }: {
    messages: any[];
    statusMessages: string[];
    loading: boolean;
    selectedSource: string;
    onRegenerateLastMessage: (source: string) => void;
  }) => {
    if (messages.length === 0 && statusMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <Bot size={40} className="mb-2" />
          <div className="flex items-center mt-2 text-xs"></div>
        </div>
      );
    }

    return (
      <>
        {[...messages].map((message, index) => {
          const isAi = message.sender === "ai";

          return (
            <div key={index} className="space-y-2 select-text">
              <MessageItem
                message={message}
                onRegenerate={
                  isAi
                    ? () => onRegenerateLastMessage(selectedSource)
                    : undefined
                }
                loading={loading}
                showCoT={true}
                isRenderRef={true} // Always render references for history messages
              />

              {message.sender === "user" &&
                statusMessages.length > 0 &&
                index === messages.length - 1 && (
                  <div className="ml-11 mt-2">
                    <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted">
                      <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-blue-600">处理进度</p>
                        {statusMessages.map((msg, i) => (
                          <p key={i} className="text-muted-foreground">
                            {msg}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          );
        })}
      </>
    );
  },
);

HistoryMessages.displayName = "HistoryMessages";

export function ChatThread({
  messages,
  statusMessages,
  currentAiMessage,
  loading,
  selectedSource,
  onRegenerateLastMessage,
  showScrollButton,
  followMode,
  onEnableFollowMode,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the stick-to-bottom hook
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
    useStickToBottom();

  // Effect to scroll to bottom when messages change and follow mode is enabled
  useEffect(() => {
    if (followMode) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, currentAiMessage, followMode, scrollToBottom]);

  // Scroll to bottom and enable follow mode
  const scrollToBottomAndEnableFollow = useCallback(() => {
    onEnableFollowMode();
    scrollToBottom();
  }, [onEnableFollowMode, scrollToBottom]);

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* 聊天历史区域 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex-col-reverse p-4"
      >
        <div ref={contentRef} className="pb-4">
          <HistoryMessages
            messages={messages}
            statusMessages={statusMessages}
            loading={loading}
            selectedSource={selectedSource}
            onRegenerateLastMessage={onRegenerateLastMessage}
          />

          {/* 当前生成的AI消息 */}
          {(currentAiMessage.content || currentAiMessage.CoT) && (
            <MessageItem
              message={{
                ...currentAiMessage,
                timestamp: new Date(),
              }}
              showCoT={true}
              isRenderRef={!loading} // Don't render references during streaming to avoid flashing, but render when complete
            />
          )}

          {/* This is the phantom div at the end of messages as suggested in the Medium article */}
          <div ref={messagesEndRef} />
        </div>

        {loading && (
          <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            正在从检索相关内容...
          </div>
        )}
      </div>

      {/* 滚动到底部按钮 */}
      {showScrollButton && (
        <Button
          onClick={scrollToBottomAndEnableFollow}
          className="absolute bottom-4 right-8 transition-opacity duration-200 z-20 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90"
          size="icon"
          aria-label="滚动到底部"
        >
          <ArrowDown size={16} />
        </Button>
      )}
    </div>
  );
}
