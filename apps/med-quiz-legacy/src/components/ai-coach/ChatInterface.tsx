"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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
  Plus,
  MoreVertical,
  History,
  Settings,
  Cpu,
} from "lucide-react";
import { ChatThread } from "./ChatThread";
import { useStickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
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
import type { SupportedLLM } from "@/lib/LLM/LLMProvider";

interface ChatInterfaceProps {
  messages: any[];
  statusMessages: string[];
  currentAiMessage: any;
  loading: boolean;
  selectedSource: string;
  hasSelectedQuiz: boolean;
  onSendMessage: (
    message: string,
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
    useHybrid?: boolean,
    selectedModel?: string,
    useReasoning?: boolean,
  ) => Promise<void>;
  onRegenerateLastMessage: (source: string) => void;
  onCancelRequest: () => void;
  onClearChat: () => void;
  cotMessages?: string[];
  speechQueue?: string[];
  isSpeaking?: boolean;
  showCoT?: boolean;
  quizContentForInput?: string | null;
  onMessagesUpdate?: (messages: any[]) => void; // Add this new prop
  onSessionTitleChange?: (title: string) => void; // Add this prop
  hideHeader?: boolean; // Add this prop to hide the header
  hideSessionPanel?: boolean; // Add this prop
}

export default function ChatInterface({
  messages,
  statusMessages,
  currentAiMessage,
  loading,
  selectedSource,
  hasSelectedQuiz,
  onSendMessage,
  onRegenerateLastMessage,
  onCancelRequest,
  onClearChat,
  quizContentForInput,
  onMessagesUpdate, // Add this new prop
  onSessionTitleChange, // Add this prop
  hideHeader = false, // Add this prop
  hideSessionPanel = false, // Add this prop
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [useHyDE, setUseHyDE] = useState(false);
  const [useHybrid, setUseHybrid] = useState(false);
  const [useReasoning, setUseReasoning] = useState(true); // Add useReasoning state
  const [selectedModel, setSelectedModel] =
    useState<SupportedLLM>("GLM45Flash"); // Default model
  const [followMode, setFollowMode] = useState(false); // Track if we should follow new messages
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionPanel, setShowSessionPanel] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use the stick-to-bottom hook
  const { isAtBottom, scrollToBottom } = useStickToBottom();

  const { data: session } = useSession();

  // Memoize the ChatThread component to prevent unnecessary re-renders
  const chatThread = useMemo(
    () => (
      <ChatThread
        messages={messages}
        statusMessages={statusMessages}
        currentAiMessage={currentAiMessage}
        loading={loading}
        selectedSource={selectedSource}
        onRegenerateLastMessage={onRegenerateLastMessage}
        showScrollButton={!isAtBottom && !followMode}
        followMode={followMode}
        onEnableFollowMode={() => setFollowMode(true)}
      />
    ),
    [
      messages,
      statusMessages,
      currentAiMessage,
      loading,
      selectedSource,
      onRegenerateLastMessage,
      isAtBottom,
      followMode,
      setFollowMode,
    ],
  );

  // Initialize session
  useEffect(() => {
    if (session?.user) {
      // Pre-create a session for immediate use
      preCreateSession();
    }
  }, [session]);

  // Pre-create session for immediate availability
  const preCreateSession = useCallback(async () => {
    try {
      // Only create if no current session exists
      if (!currentSessionId) {
        const newSessionId = await chatClientService.createSession();
        setCurrentSessionId(newSessionId);
      }
    } catch (error) {
      console.error("Failed to pre-create session:", error);
      // Silently fail - session will be created on first message if needed
    }
  }, [currentSessionId]);

  const clearCurrentSession = async () => {
    if (!currentSessionId) return;

    try {
      await chatClientService.clearSession(currentSessionId);
      onClearChat();
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  };


  // Auto-adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // Update input when quizContentForInput changes
  useEffect(() => {
    if (quizContentForInput) {
      setInput(quizContentForInput);
    }
  }, [quizContentForInput]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (input.trim() === "" || loading) return;

    try {
      // Ensure we have a session ID (either pre-created or create now)
      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        try {
          activeSessionId = await chatClientService.createSession();
          setCurrentSessionId(activeSessionId);
        } catch (sessionError) {
          console.error("Failed to create session on demand:", sessionError);
          toast.error("创建会话失败，请重试");
          return; // Don't proceed with message sending if session creation fails
        }
      }

      await onSendMessage(
        input.trim(),
        "vault", // selectedSource with default value
        "", // analysisLLMId with default value
        "", // workerLLMId with default value
        useHyDE,
        useHybrid,
        selectedModel,
        useReasoning, // Add useReasoning parameter
      );
      setInput("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Show error to user with more details
      let errorMessage = "未知错误";
      if (error.message) {
        errorMessage = error.message;
        console.error("Error details:", error.message);
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      toast.error("发送消息失败: " + errorMessage);
    }
  }, [
    input,
    loading,
    onSendMessage,
    useHyDE,
    useHybrid,
    currentSessionId,
  ]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent event propagation to avoid conflicts with parent components
    e.stopPropagation();

    // Check if device is mobile
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    // Only allow Enter submission on non-mobile devices
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
    <div className="h-[95vh] flex flex-col">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">

        <div className={`flex-1 min-h-0 ${hideHeader ? "" : ""}`}>
          {chatThread}
        </div>

        {/* 输入区域容器 */}
        <div className="w-full p-1 bg-transparent z-10">
          <div className="p-0 shrink-0 bg-background">
            <div className="relative w-full px-0">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`向课本提问...`}
                className="resize-none pr-10 pb-6 bg-background max-h-[200px]"
                rows={2}
                disabled={loading}
              />
              <div className="absolute right-2 bottom-7 flex gap-1">
                {loading ? (
                  <Button
                    variant="destructive"
                    onClick={onCancelRequest}
                    size="sm"
                    className="h-8"
                  >
                    取消
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
              {/* Menubar positioned inside the TextArea at the bottom, without model selection */}
              <div className="absolute bottom-1 left-1 w-auto">
                <Menubar className="bg-transparent border-none p-0 h-5">
                  <MenubarMenu>
                    <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                      <History size={16} />
                    </MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem
                        onClick={() => setShowSessionPanel(!showSessionPanel)}
                      >
                        {showSessionPanel ? "隐藏历史" : "显示历史"}
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>

                  <MenubarMenu>
                    <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                      <Settings size={16} />
                    </MenubarTrigger>
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
                      <MenubarItem
                        onClick={() => setUseReasoning(!useReasoning)}
                        className={useReasoning ? "bg-accent" : ""}
                      >
                        {useReasoning ? "✓ " : ""}启用推理模式
                      </MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger className="h-5 px-2 py-0.5 text-xs">
                      <Cpu size={16} />
                    </MenubarTrigger>
                    <MenubarContent>
                      <div className="p-2">
                        <label className="text-xs text-muted-foreground">
                          选择模型
                        </label>
                        <select
                          value={selectedModel}
                          onChange={(e) =>
                            setSelectedModel(e.target.value as SupportedLLM)
                          }
                          className="w-full mt-1 text-sm bg-background border rounded px-2 py-1"
                        >
                          <option value="Hunyuanlite">Hunyuanlite</option>
                          <option value="GLM4Flash">GLM4Flash</option>
                          <option value="QiniuDeepseekV3">
                            QiniuDeepseekV3
                          </option>
                          <option value="OpenrouterQWEN3">
                            OpenrouterQWEN3
                          </option>
                          <option value="QWen3Reasoning">QWen3Reasoning</option>
                          <option value="QWen3">QWen3</option>
                          <option value="GLM4Plus">GLM4Plus</option>
                          {/* GLM Models */}
                          <option value="GLM45">GLM-4.5</option>
                          <option value="GLM45X">GLM-4.5-X</option>
                          <option value="GLM45Air">GLM-4.5-Air</option>
                          <option value="GLM45AirX">GLM-4.5-AirX</option>
                          <option value="GLM45Flash">GLM-4.5-Flash</option>
                          <option value="GLMZ1AirX">GLM-Z1-AirX</option>
                          <option value="GLM41VThinkingFlash">
                            GLM-4.1V-Thinking-Flash
                          </option>
                          <option value="GLMZ1Air">GLM-Z1-Air</option>
                          <option value="GLMZ1Flash">GLM-Z1-Flash</option>
                          <option value="GLM4Air250414">
                            GLM-4-Air-250414
                          </option>
                          <option value="GLM4Flash250414">
                            GLM-4-Flash-250414
                          </option>
                          <option value="CogVideoX3">CogVideoX-3</option>
                          <option value="GLM4Long">GLM-4-Long</option>
                          <option value="GLM4VPlus0111">
                            GLM-4V-Plus-0111
                          </option>
                          <option value="GLM4Air">GLM-4-Air</option>
                          <option value="GLM4FlashX">GLM-4-FlashX</option>
                          <option value="GLM4Flash">GLM-4-Flash</option>
                          <option value="GLM4AirX">GLM-4-AirX</option>
                          <option value="GLM49B">GLM-4-9B</option>
                          <option value="GLM4VPlus">GLM-4V-Plus</option>
                          <option value="GLM4VFlash">GLM-4V-Flash</option>
                          <option value="GLM4V">GLM-4V</option>
                          <option value="Rerank">Rerank</option>
                          <option value="CogView4250304">
                            CogView-4-250304
                          </option>
                          <option value="CogView3Plus">CogView-3-Plus</option>
                          <option value="CogView3Flash">CogView-3-Flash</option>
                          <option value="CogView3">CogView-3</option>
                          <option value="GLM4Assistant">GLM-4-Assistant</option>
                          <option value="GLM4AllTools">GLM-4-AllTools</option>
                          <option value="CogVideoXFlash">
                            CogVideoX-Flash
                          </option>
                          <option value="CogVideoX2">CogVideoX-2</option>
                          <option value="CogVideoX">CogVideoX</option>
                          <option value="Embedding3">Embedding-3</option>
                          <option value="Embedding2">Embedding-2</option>
                          <option value="ChatGLM36B">ChatGLM3-6B</option>
                          <option value="GLM40520">GLM-4-0520</option>
                          <option value="CodeGeeX4">CodeGeeX-4</option>
                          <option value="GLM4Voice">GLM-4-Voice</option>
                          <option value="Tts_1">Tts_1</option>
                          <option value="QwenTurbo">QwenTurbo</option>
                          <option value="QwenTurboLatest">
                            QwenTurboLatest
                          </option>
                          <option value="QwenTurbo20250715">
                            QwenTurbo20250715
                          </option>
                          <option value="QwenTurbo20250428">
                            QwenTurbo20250428
                          </option>
                          <option value="QwenTurbo20250211">
                            QwenTurbo20250211
                          </option>
                          <option value="QwenTurbo20240919">
                            QwenTurbo20240919
                          </option>
                          <option value="QwenTurbo20241101">
                            QwenTurbo20241101
                          </option>
                          <option value="QwenTurbo20240624">
                            QwenTurbo20240624
                          </option>
                          <option value="QwenPlus">QwenPlus</option>
                          <option value="QwenPlusLatest">QwenPlusLatest</option>
                          <option value="QwenPlus20250714">
                            QwenPlus20250714
                          </option>
                          <option value="QwenPlus20250428">
                            QwenPlus20250428
                          </option>
                          <option value="QwenPlus20250125">
                            QwenPlus20250125
                          </option>
                          <option value="QwenPlus20241125">
                            QwenPlus20241125
                          </option>
                          <option value="QwenPlus20241127">
                            QwenPlus20241127
                          </option>
                          <option value="QwenPlus20241220">
                            QwenPlus20241220
                          </option>
                          <option value="QwenPlus20250112">
                            QwenPlus20250112
                          </option>
                        </select>
                      </div>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
