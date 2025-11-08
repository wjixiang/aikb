"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageItem } from "./MessageItem";
import { CoTDisplay } from "./CoTDisplay";
import {
  Loader2,
  Send,
  Bot,
  Info,
  Trash2,
  ArrowDown,
  History,
  Plus,
  MoreVertical,
} from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { ScrollArea } from "../ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  chatClientService,
  type ChatSession,
} from "@/lib/services/ChatClientService";
import { useSession } from "next-auth/react";

interface EnhancedChatInterfaceProps {
  selectedSource: string;
  hasSelectedQuiz: boolean;
  onSendQuiz: (withAnswer?: boolean) => void;
}

export default function EnhancedChatInterface({
  selectedSource,
  hasSelectedQuiz,
  onSendQuiz,
}: EnhancedChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentAiMessage, setCurrentAiMessage] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [useHyDE, setUseHyDE] = useState(false);
  const [useHybrid, setUseHybrid] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [followMode, setFollowMode] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();

  // Initialize session
  useEffect(() => {
    if (session?.user) {
      initializeNewSession();
    }
  }, [session]);

  const initializeNewSession = async () => {
    try {
      const newSessionId = await chatClientService.createSession();
      setCurrentSessionId(newSessionId);
      setMessages([]);
      setStatusMessages([]);
      setCurrentAiMessage({});
    } catch (error) {
      console.error("Failed to initialize session:", error);
    }
  };

  const clearCurrentSession = async () => {
    if (!currentSessionId) return;

    try {
      await chatClientService.clearSession(currentSessionId);
      setMessages([]);
      setStatusMessages([]);
      setCurrentAiMessage({});
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  };

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 10;

    setIsAtBottom(isBottom);
    setShowScrollButton(!isBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
        setIsAtBottom(true);
        setShowScrollButton(false);
      }
    }, 100);
  }, []);

  const scrollToBottomAndEnableFollow = useCallback(() => {
    setFollowMode(true);
    scrollToBottom();
  }, [scrollToBottom]);

  // Auto-scroll behavior
  useEffect(() => {
    if (isAtBottom || messages.length === 0 || followMode) {
      scrollToBottom();
    }
  }, [messages, currentAiMessage, isAtBottom, followMode, scrollToBottom]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (!isAtBottom && followMode) {
      setFollowMode(false);
    }
  }, [isAtBottom, followMode]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // Enhanced send message function
  const sendMessage = useCallback(async () => {
    if (input.trim() === "" || loading || !currentSessionId) return;

    try {
      setLoading(true);

      // Add user message to local state
      const userMessage = {
        sender: "user",
        content: input.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Note: Message pushing to backend has been removed

      // Simulate AI response (replace with actual API call)
      setTimeout(() => {
        const aiMessage = {
          sender: "ai",
          content: "这是AI的回复...",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setLoading(false);
      }, 1000);

      setInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(false);
    }
  }, [input, loading, currentSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!session?.user) {
    return (
      <div className="h-[95vh] flex items-center justify-center">
        <div className="text-center">
          <Bot size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">请先登录以使用AI助手</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[95vh] flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">AI助手</h2>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4"
          onScroll={handleScroll}
        >
          <div className="pb-4">
            {messages.length === 0 && statusMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Bot size={40} className="mb-2" />
                <p>开始新的对话吧！</p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const isAi = message.sender === "ai";

                  return (
                    <div key={index} className="space-y-2 select-text">
                      <MessageItem
                        message={message}
                        loading={loading}
                        showCoT={true}
                      />

                      {message.sender === "user" &&
                        statusMessages.length > 0 &&
                        index === messages.length - 1 && (
                          <div className="ml-11 mt-2">
                            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted">
                              <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-blue-600">
                                  处理进度
                                </p>
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
            )}

            {currentAiMessage.content && (
              <MessageItem
                message={{
                  ...currentAiMessage,
                  timestamp: new Date(),
                }}
                showCoT={true}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {loading && (
            <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              正在处理中...
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            onClick={scrollToBottomAndEnableFollow}
            className="absolute bottom-32 right-8 transition-opacity duration-200 z-20 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90"
            size="icon"
            aria-label="滚动到底部"
          >
            <ArrowDown size={16} />
          </Button>
        )}

        {/* Input Area */}
        <div className="w-full p-1 bg-transparent z-10">
          <Menubar className="w-full bg-transparent mb-2 border-none">
            <MenubarMenu>
              <MenubarTrigger>试题发送</MenubarTrigger>
              <MenubarContent>
                {hasSelectedQuiz && (
                  <MenubarItem onClick={() => onSendQuiz()}>
                    不带答案盲答
                  </MenubarItem>
                )}
                {hasSelectedQuiz && (
                  <MenubarItem onClick={() => onSendQuiz(true)}>
                    带答案解析
                  </MenubarItem>
                )}
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>设置</MenubarTrigger>
              <MenubarContent>
                <MenubarItem
                  onClick={clearCurrentSession}
                  disabled={messages.length === 0 || loading}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> 清空对话
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  onClick={() => setUseHyDE(!useHyDE)}
                  className={useHyDE ? "bg-accent" : ""}
                >
                  {useHyDE ? "✓ " : ""}启用HyDE检索
                </MenubarItem>
                <MenubarItem
                  onClick={() => setUseHybrid(!useHybrid)}
                  className={useHybrid ? "bg-accent" : ""}
                >
                  {useHybrid ? "✓ " : ""}启用混合检索
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>

          <div className="p-0 shrink-0 bg-background">
            <div className="flex">
              <div className="relative w-full px-0">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`向知识库提问...`}
                  className="resize-none pr-10 bg-background max-h-[200px]"
                  rows={2}
                  disabled={loading}
                />
                <div className="absolute right-2 bottom-2 flex gap-1">
                  {loading ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      disabled
                    >
                      处理中...
                    </Button>
                  ) : (
                    <Button
                      onClick={sendMessage}
                      disabled={input.trim() === ""}
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Send size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
