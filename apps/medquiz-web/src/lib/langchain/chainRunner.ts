import { Document } from './chainFactory';
import ChainManager from './chainManager';
import { ChatMessage } from '../agents/agent.types';
import {
  ABORT_REASON,
  AI_SENDER,
  DEFAULT_SYSTEM_PROMPT,
  EMPTY_INDEX_ERROR_MESSAGE,
} from './prompt';
import { extractChatHistory } from './utils';
import { NotebookRetriever } from './retriever/noteBookRetriever';
import { NoteRetriever } from './hybridRetriever';
import { getChatModel } from './provider';

export interface RetrieveAIResponse {
  content: string;
  source: Document[];
}

export interface ChainRunner {
  run(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    },
  ): Promise<RetrieveAIResponse>;
}

export abstract class BaseChainRunner implements ChainRunner {
  constructor(protected chainManager: ChainManager) {}

  abstract run(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    },
    collectionName?: string,
  ): Promise<RetrieveAIResponse>;

  /**
   * 发射最终响应
   * @param fullAIResponse
   * @param userMessage
   * @param abortController
   * @param addMessage
   * @param updateCurrentAiMessage
   * @param debug
   * @param sources
   * @returns
   */
  protected async handleResponse(
    fullAIResponse: string,
    userMessage: ChatMessage,
    abortController: AbortController,
    addMessage: (message: ChatMessage) => void,
    updateCurrentAiMessage: (message: string) => void,
    debug: boolean,
    sources?: { title: string; score: number; content: string }[],
  ) {
    if (
      fullAIResponse &&
      abortController.signal.reason !== ABORT_REASON.NEW_CHAT
    ) {
      await this.chainManager.memoryManager
        .getMemory()
        .saveContext(
          { input: userMessage.content },
          { output: fullAIResponse },
        );

      addMessage({
        content: fullAIResponse,
        sender: AI_SENDER,
        isVisible: true,
        timestamp: new Date(),
        // sources: sources?.map(),
        messageType: 'content',
      });
    }
    updateCurrentAiMessage('');

    const response: RetrieveAIResponse = {
      content: fullAIResponse,
      source: ChainManager.retrievedDocuments,
    };
    return response;
  }
}

export class VaultQAChainRunner extends BaseChainRunner {
  async run(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    },
  ): Promise<RetrieveAIResponse> {
    const { debug = false } = options;
    let fullAIResponse = '';

    try {
      const memory = this.chainManager.memoryManager.getMemory();
      const memoryVariables = await memory.loadMemoryVariables({});
      const chatHistory = extractChatHistory(memoryVariables);
      console.log('ready to retrieve information');
      const qaStream = await ChainManager.getRetrievalChain().stream({
        question: userMessage.content,
        chat_history: chatHistory,
      } as any);
      // console.log("4. qaStream", qaStream)

      for await (const chunk of qaStream) {
        if (abortController.signal.aborted) break;
        fullAIResponse += chunk.content;
        updateCurrentAiMessage(fullAIResponse);
      }
      console.log('fullAIResponse', fullAIResponse);
      fullAIResponse = this.addSourcestoResponse(fullAIResponse);
    } catch (error) {
      console.log(error, debug, addMessage, updateCurrentAiMessage);
    }

    return this.handleResponse(
      fullAIResponse,
      userMessage,
      abortController,
      addMessage,
      updateCurrentAiMessage,
      debug,
    );
  }

  private addSourcestoResponse(response: string): string {
    // const docTitles = extractUniqueTitlesFromDocs(ChainManager.retrievedDocuments);
    //   if (docTitles.length > 0) {
    //     const links = docTitles.map((title) => `- [[${title}]]`).join("\n");
    //     response += "\n\n#### Sources:\n\n" + links;
    //   }
    //   return response;
    // }
    // console.log(ChainManager.retrievedDocuments)

    return response;
  }
}

export class NotebookChainRunner extends BaseChainRunner {
  async run(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    },
    notebookName: string,
  ): Promise<RetrieveAIResponse> {
    let fullAIResponse = '';

    if (options?.updateLoading) {
      options.updateLoading(true);
    }

    try {
      // 获取聊天历史
      const memory = this.chainManager.memoryManager.getMemory();
      const memoryVariables = await memory.loadMemoryVariables({});
      const chatHistory = extractChatHistory(memoryVariables);

      // 初始化检索器
      const notebookRetri = new NotebookRetriever(notebookName, {
        minSimilarityScore: 0.01,
        maxK: 10,
        salientTerms: [],
      });

      if (options?.debug) {
        console.log('开始从笔记中检索相关内容...');
      }

      // 获取相关文档
      const documents = await notebookRetri.getRelevantDocuments(
        userMessage.content,
        { callbacks: [] },
      );

      if (options?.debug) {
        console.log(`检索到 ${documents.length} 个相关文档片段`);
      }

      // 保存检索到的文档以便显示引用来源
      ChainManager.retrievedDocuments = documents;

      // 如果没有找到相关文档
      if (documents.length === 0) {
        fullAIResponse =
          '没有找到与您问题相关的笔记内容。请尝试重新表述您的问题，或查询其他主题。';
        updateCurrentAiMessage(fullAIResponse);
      } else {
        // 构建上下文
        const context = this.buildContext(documents);

        // 构建提示
        const prompt = this.buildPrompt(
          userMessage.content,
          context,
          JSON.stringify(chatHistory),
        );

        // 调用LLM进行总结
        const chatModel = getChatModel()('deepseek-v3');

        if (options?.debug) {
          console.log('准备使用LLM总结检索到的内容...');
        }

        // 流式处理LLM响应
        const stream = await chatModel.stream(prompt);

        // 接收流式响应
        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;

          // 获取内容
          if (chunk.content) {
            fullAIResponse += chunk.content;
            updateCurrentAiMessage(fullAIResponse);
          }
        }

        if (options?.debug) {
          console.log('LLM总结完成，响应长度:', fullAIResponse.length);
        }
      }
    } catch (error) {
      console.error('NotebookChainRunner处理过程中出错:', error);
      fullAIResponse = '处理您的请求时出现错误。请稍后重试。';
      updateCurrentAiMessage(fullAIResponse);
    } finally {
      if (options?.updateLoading) {
        options.updateLoading(false);
      }
    }

    // 添加源引用
    const sources = ChainManager.retrievedDocuments.map((doc) => ({
      title: doc.metadata.title,
      score: doc.metadata?.score || 0,
      content: doc.pageContent,
    }));

    return this.handleResponse(
      fullAIResponse,
      userMessage,
      abortController,
      addMessage,
      updateCurrentAiMessage,
      false,
      sources,
    );
  }

  // 构建文档上下文
  private buildContext(documents: Document[]): string {
    const contextParts: string[] = [];

    documents.forEach((doc, index) => {
      // 从文档中提取内容
      const content = doc.pageContent.trim();

      // 从元数据中提取有用信息
      const metadata = doc.metadata || {};
      const fileName = metadata.title;

      // 添加到上下文
      contextParts.push(
        `[文档 ${index + 1}] ${fileName ? `来源: ${fileName}` : ''}\n${content}`,
      );
    });

    return contextParts.join('\n\n');
  }

  // 构建提示
  private buildPrompt(
    question: string,
    context: string,
    chatHistory: string,
  ): string {
    return `
  你是一个专业的助手，请基于以下提供的内容回答用户的问题。
  
  ### 相关上下文信息:
  ${context}
  
  ### 聊天历史:
  ${chatHistory}
  
  ### 用户问题:
  ${question}
  
  请根据提供的上下文信息回答用户的问题。如果上下文中没有足够的信息来回答问题，请坦率地说明你不知道，而不要编造信息。
  如果回答基于多个源文档，可以适当引用源文档编号，如[文档1]提到...。
  回答应该信息丰富、条理清晰，并尽可能直接回应用户的具体问题。
  `;
  }

  // 流式处理辅助方法（保留以便需要时使用）
  async streamFromDocuments(
    documents: Document[],
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
  ): Promise<string> {
    let fullResponse = '';
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const doc of documents) {
      if (abortController.signal.aborted) break;

      const content = doc.pageContent;

      const segments = content.split('. ');
      for (const segment of segments) {
        if (abortController.signal.aborted) break;

        fullResponse += segment + '. ';
        updateCurrentAiMessage(fullResponse);
        await delay(100);
      }

      fullResponse += '\n\n';
      updateCurrentAiMessage(fullResponse);
    }

    return fullResponse;
  }
}
