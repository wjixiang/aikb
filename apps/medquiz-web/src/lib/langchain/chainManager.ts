import { RunnableSequence } from '@langchain/core/runnables';
import ChainFactory from './chainFactory';
import { getChatModel } from './provider';
import { Document } from '@langchain/core/documents';
import { ChatMessage } from '../agents/agent.types';
import {
  NotebookChainRunner,
  RetrieveAIResponse,
  VaultQAChainRunner,
} from './chainRunner';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import MemoryManager from './memoryManager';
import { NoteRetriever } from './hybridRetriever';

export default class ChainManager {
  maxK = 10;
  private static retrievalChain: RunnableSequence =
    ChainFactory.createConversationalRetrievalChain(
      {
        llm: getChatModel()('deepseek-r1'),
        retriever: new NoteRetriever({
          minSimilarityScore: 0.01,
          maxK: 10,
          salientTerms: [],
        }),
        systemMessage: DEFAULT_SYSTEM_PROMPT,
      },
      ChainManager.storeRetrieverDocuments.bind(ChainManager),
    );

  public static retrievedDocuments: Document[] = [];
  public memoryManager: MemoryManager;

  constructor() {
    this.memoryManager = MemoryManager.getInstance();
  }

  async initMemory() {
    await MemoryManager.getInstance().clearChatMemory();
  }

  runChain = async (
    referenceSource: string,
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    } = {},
  ): Promise<RetrieveAIResponse> => {
    const ChainRunner = new NotebookChainRunner(this);
    switch (referenceSource) {
      case 'notebook':
        console.log('start notebook runChain');
        // await this.initMemory()
        return await ChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'notebook',
        );
      case 'physiology':
        console.log('start notebook runChain');
        // await this.initMemory()
        return await ChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'physiology',
        );
      case 'pathology':
        console.log('start notebook runChain');
        // await this.initMemory()
        return await ChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'pathology',
        );
      case 'surgery':
        console.log('start notebook runChain');
        // await this.initMemory()
        return await ChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'surgery',
        );
      case 'internal':
        console.log('start notebook runChain');
        // await this.initMemory()
        return await ChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'internal',
        );
      case 'infectious':
        console.log('start notebook runChain');
        // await this.initMemory()
        const infectiousChainRunner = new NotebookChainRunner(this);
        return await infectiousChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'infectious',
        );
      case 'neurology':
        console.log('start notebook runChain');
        // await this.initMemory()
        const notebookChainRunner = new NotebookChainRunner(this);
        return await notebookChainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
          'neurology',
        );
      case 'vault':
      default:
        console.log('start runChain');
        // await this.initMemory()
        const chainRunner = new VaultQAChainRunner(this);
        return await chainRunner.run(
          userMessage,
          abortController,
          updateCurrentAiMessage,
          addMessage,
          options,
        );
    }
  };

  static storeRetrieverDocuments(documents: Document[]) {
    ChainManager.retrievedDocuments = documents;
  }

  static getRetrievalChain(): RunnableSequence {
    // console.log("ChainManager.retrievalChain", ChainManager.retrievalChain)
    return ChainManager.retrievalChain;
  }
}
