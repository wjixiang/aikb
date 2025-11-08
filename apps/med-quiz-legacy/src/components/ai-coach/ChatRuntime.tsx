"use client";

import { useState, useRef, useCallback } from "react";
import { ChatMessage } from "@/lib/agents/agent.types";
import { toast } from "sonner";
import { QuizWithUserAnswer } from "@/types/quizData.types";
import { AgentMessage, NodeStatus, ChatReq } from "@/lib/agents/agent.types";
import { chatClientService } from "@/lib/services/ChatClientService";

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizWithUserAnswer[],
): QuizWithUserAnswer[] => {
  const typeOrder: Record<string, number> = {
    A1: 0,
    A2: 0,
    A3: 1,
    B: 2,
    X: 3,
  };

  return [...quizzes].sort((a, b) => {
    const orderA = typeOrder[a.type] ?? 999;
    const orderB = typeOrder[b.type] ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return 0; // Maintain original order for same types
  });
};

export interface UseChatRuntime {
  mode: "simple" | "agent";
  setMode: (mode: "simple" | "agent") => void;
  messages: ChatMessage[];
  statusMessages: string[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentAiMessage: ChatMessage;
  loading: boolean;
  graphState: any;
  nodeStatus: NodeStatus | null;
  sendMessage: (
    input: string,
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
    useHybrid?: boolean,
    selectedModel?: string,
    useReasoning?: boolean,
  ) => Promise<void>;
  cancelRequest: () => void;
  regenerateLastMessage: (
    selectedSource?: string,
    analysisLLMId?: string,
    workerLLMId?: string,
    useHyDE?: boolean,
  ) => Promise<void>;
  clearChat: () => void;
  quizzes: QuizWithUserAnswer[];
  setQuizzes: React.Dispatch<React.SetStateAction<QuizWithUserAnswer[]>>;
  currentQuizSetId: string | null;
  setCurrentQuizSetId: React.Dispatch<React.SetStateAction<string | null>>;
  cotMessages: string[];
  speechQueue: string[];
  isSpeaking: boolean;
}

export const useChatRuntime = (
  initialMode: "simple" | "agent" = "simple",
): UseChatRuntime => {
  const [mode, setMode] = useState<"simple" | "agent">(initialMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [currentAiMessage, setCurrentAiMessage] = useState<ChatMessage>({
    CoT: "",
    content: "",
    sender: "ai",
    timestamp: new Date(),
    isVisible: true,
    messageType: "content",
  });
  const [cotMessages, setCotMessages] = useState<string[]>([]);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [graphState, setGraphState] = useState<any>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  // const [references, setReferences] = useState<any[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef<string>("");
  const accumulatedCoTRef = useRef<string>("");

  const [quizzes, setQuizzes] = useState<QuizWithUserAnswer[]>([]);
  const [currentQuizSetId, setCurrentQuizSetId] = useState<string | null>(null);

  const processChunk = useCallback(async (parsedChunk: AgentMessage) => {
    console.log(
      "Processing chunk type:",
      parsedChunk.type,
      "content:",
      parsedChunk.content,
    );
    if (parsedChunk.type === "quizzes" && parsedChunk.quizzes) {
      console.log("add quiz");
      if (Array.isArray(parsedChunk.quizzes)) {
        console.log("add quiz quiz");
        const newQuizzes = parsedChunk.quizzes;
        setQuizzes((prev) => sortQuizzesByType([...prev, ...newQuizzes]));
      }
    }

    switch (parsedChunk.type) {
      case "step":
        console.log("Step message:", parsedChunk.content);
        setMessages((prev) => [
          ...prev,
          {
            messageType: "status",
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            content: parsedChunk.content,
          },
        ]);
        break;
      case "notice":
        console.log("Step message:", parsedChunk.content);
        setMessages((prev) => [
          ...prev,
          {
            messageType: "content",
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            content: parsedChunk.content,
          },
        ]);
        break;
      case "cot":
        console.log("CoT message:", parsedChunk.content);
        setCurrentAiMessage((prev) => ({
          ...prev,
          CoT: (prev.CoT ?? "") + parsedChunk.content,
          timestamp: new Date(),
          sources: [],
        }));
        break;
      case "speech":
        console.log("Speech message:", parsedChunk.speechData?.text);
        if (parsedChunk.speechData?.text) {
          setSpeechQueue((prev) => [...prev, parsedChunk.speechData!.text]);
        }
        if (parsedChunk.speechData?.isComplete) {
          setIsSpeaking(false);
        }
        break;
      case "update":
        console.log("Update message:", parsedChunk.content);
        setCurrentAiMessage((prev) => ({
          ...prev,
          content: prev.content + parsedChunk.content,
          timestamp: new Date(),
          sources: parsedChunk.references ? parsedChunk.references : [],
        }));
        break;
      case "done":
        console.log("Done message with references:", parsedChunk.references);
        const aiMessage = {
          ...currentAiMessage,
          content: accumulatedContentRef.current,
          sources: parsedChunk.references,
          CoT: accumulatedCoTRef.current,
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Note: Message saving to backend has been removed
        break;
      case "error":
        console.error(
          "Error chunk:",
          parsedChunk.error || parsedChunk.content || "Unknown error",
        );
        toast.error(parsedChunk.content);
        // Clear CoT messages on error
        setCotMessages([]);
        break;
      case "references":
        console.log("References chunk:", parsedChunk.references);
        break;
    }

    if (parsedChunk.node && parsedChunk.status) {
      setNodeStatus({
        node: parsedChunk.node,
        status: parsedChunk.status,
        error: parsedChunk.error,
      });
    }
  }, []);

  const sendMessage = useCallback(
    async (
      input: string,
      selectedSource: string = "vault",
      analysisLLMId: string = "",
      workerLLMId: string = "",
      useHyDE: boolean = false,
      useHybrid: boolean = false,
      selectedModel: string = "QiniuDeepseekV3",
      useReasoning: boolean = true,
    ) => {
      if (loading) return;

      setLoading(true);
      accumulatedContentRef.current = ""; // Initialize accumulated content
      accumulatedCoTRef.current = "";
      setCurrentAiMessage({
        content: "",
        sender: "ai",
        timestamp: new Date(),
        isVisible: true,
        messageType: "content",
      });
      setNodeStatus(null);
      // setReferences([]);

      const userMessage: ChatMessage = {
        content: input,
        sender: "user",
        timestamp: new Date(),
        isVisible: true,
        messageType: "content",
        metadata: {
          useHyDE: useHyDE,
          useHybrid: useHybrid,
          useReasoning: useReasoning,
        },
      };

      setMessages((prevMessages) => [...prevMessages, userMessage]);

      // Note: Message saving to backend has been removed

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const historyMessages = messages.map((msg) => ({
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          isVisible: msg.isVisible,
          sources: msg.sources,
          messageType: msg.messageType || "content",
        }));

        const requestBody: ChatReq = {
          mode,
          messages: [...historyMessages, userMessage],
          analysisLLMId,
          workerLLMId,
          selectedSource,
          rag_config: {
            useHyDE: useHyDE,
            useHybrid: useHybrid,
            useReasoning: useReasoning, // Add useReasoning to rag_config
            topK: 10, // Will allow custom setting in future
            language: "zh",
            llm: selectedModel as any, // Type assertion since we know it's a valid model
          },
        };

        const response = await fetch("/api/chatbot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok || !response.body) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch from API");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";

        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const messages = buffer.split("\n");
          buffer = messages.pop() || ""; // Keep the last incomplete message in the buffer

          for (const message of messages) {
            try {
              const parsedChunk: AgentMessage = JSON.parse(message);
              console.log("Received chunk:", parsedChunk); // Debug logging
              await processChunk(parsedChunk);

              if (parsedChunk.type === "update") {
                console.log("Content update:", parsedChunk.content); // Debug logging
                accumulatedContentRef.current += parsedChunk.content;
              }

              if (parsedChunk.type === "cot") {
                console.log("CoT update:", parsedChunk.content); // Debug logging
                accumulatedCoTRef.current += parsedChunk.content;
              }
            } catch (parseError) {
              console.error(
                "Failed to parse JSON chunk:",
                parseError,
                "Chunk:",
                message,
              ); // Log the problematic chunk
            }
          }
        }
        // Process any remaining content in the buffer after the stream is done
        if (buffer.trim() !== "") {
          try {
            const parsedChunk: AgentMessage = JSON.parse(buffer);
            console.log("Received final chunk:", parsedChunk);
            await processChunk(parsedChunk);
            if (parsedChunk.type === "update") {
              console.log("Content remaining update:", parsedChunk.content);
              accumulatedContentRef.current += parsedChunk.content;
            }

            if (parsedChunk.type === "cot") {
              console.log("CoT remaining update:", parsedChunk.content);
              accumulatedCoTRef.current += parsedChunk.content;
            }
          } catch (parseError) {
            console.error(
              "Failed to parse final JSON chunk:",
              parseError,
              "Chunk:",
              buffer,
            );
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("Fetch aborted");
          toast.info("请求已取消");
          setCurrentAiMessage({
            content: "请求已取消。",
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            messageType: "content",
          });
        } else {
          console.error("Error during chat:", error);
          toast.error(`发送消息失败: ${error.message}`);
          setCurrentAiMessage({
            content: `发送消息失败: ${error.message}`,
            sender: "ai",
            timestamp: new Date(),
            isVisible: true,
            messageType: "content",
            isErrorMessage: true,
          });
        }

        const errorMessage: ChatMessage = {
          content: `Error: ${error.message}`,
          sender: "ai",
          timestamp: new Date(),
          isVisible: true,
          messageType: "content",
          isErrorMessage: true,
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
        setCurrentAiMessage({
          content: "",
          CoT: "",
          sender: "ai",
          timestamp: new Date(),
          isVisible: true,
          messageType: "content",
        });
        setNodeStatus(null);
      }
    },
    [
      loading,
      messages,
      mode,
      processChunk,
      accumulatedContentRef,
      accumulatedCoTRef,
      setCurrentAiMessage,
      setMessages,
      setLoading,
      setNodeStatus,
    ],
  );

  // ... rest of the hook implementation remains the same ...
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const regenerateLastMessage = useCallback(
    async (
      selectedSource: string = "vault",
      analysisLLMId: string = "",
      workerLLMId: string = "",
      useHyDE: boolean = false,
      selectedModel: string = "QiniuDeepseekV3",
    ) => {
      if (loading || messages.length === 0) return;

      const lastUserMessageIndex = messages
        .slice()
        .reverse()
        .findIndex((msg) => msg.sender === "user");
      if (lastUserMessageIndex === -1) {
        toast.info("没有找到上一条用户消息");
        return;
      }

      const originalIndex = messages.length - 1 - lastUserMessageIndex;
      const lastUserMessage = messages[originalIndex];

      setMessages((prevMessages) => prevMessages.slice(0, originalIndex + 1));
      await sendMessage(
        lastUserMessage.content,
        selectedSource,
        analysisLLMId,
        workerLLMId,
        useHyDE,
        false,
        selectedModel,
      );
    },
    [loading, messages, sendMessage],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setStatusMessages([]);
    setCurrentAiMessage({
      content: "",
      CoT: "",
      sender: "ai",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content",
    });
    setLoading(false);
    setGraphState(null);
    setNodeStatus(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    mode,
    setMode,
    messages,
    statusMessages,
    setMessages,
    currentAiMessage,
    loading,
    graphState,
    nodeStatus,
    sendMessage,
    cancelRequest,
    regenerateLastMessage,
    clearChat,
    quizzes,
    setQuizzes,
    currentQuizSetId,
    setCurrentQuizSetId,
    cotMessages,
    speechQueue,
    isSpeaking,
  };
};
