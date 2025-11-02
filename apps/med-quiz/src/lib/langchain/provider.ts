import { Embeddings } from "@langchain/core/embeddings";
import { ChatOpenAI } from "@langchain/openai";
import provide_gptio from "./provider/provider_gptio";
import provide_gptapi from "./provider/provider_gptapi";
import * as dotenv from "dotenv";
import provide_zhizeng from "./provider/provider_zhizengzeng";
dotenv.config();

/**
 * @deprecated Embedding function has been migrated to embedding
 */
export interface embeddingInstance {
  Embeddings: Embeddings;
  EmbeddingModal: string;
}

export interface provider {
  // supported_chat_modal: Record<string, string>,
  // supported_embedding_modal: Record<string, string>,
  apikey: string;
  baseurl: string;
  getEmbeddingModal: (modelName: any) => {
    Embeddings: Embeddings;
    EmbeddingModal: string;
  };
  getChatModal: (modelName: any, temperature?: number) => ChatOpenAI;
  vectorNoteCollection: string;
}

export class LLMProvider {
  static providerList: Record<string, provider> = {};
  
  static getProvider(providerName: string): provider {
    if (!this.providerList[providerName]) {
      switch (providerName) {
        case 'gptio':
          this.providerList[providerName] = new provide_gptio();
          break;
        case 'gptapi':
          this.providerList[providerName] = new provide_gptapi();
          break;
        default:
          throw new Error(`Unknown provider: ${providerName}`);
      }
    }
    return this.providerList[providerName];
  }

  provider: provider;
  vectorNoteCollectionName: string;
  constructor(provider: provider, vectorNoteCollectionName: string) {
    this.provider = provider;
    this.vectorNoteCollectionName = vectorNoteCollectionName;
  }
}

/**
 * 遍历所有 provider 并测试它们的 getChatModal 与 getEmbeddingModal 方法
 */
export function testAllProviders(): void {
  const availableProviders = ['gptio', 'gptapi'];
  availableProviders.forEach(async (providerKey) => {
    try {
      const providerInstance = LLMProvider.getProvider(providerKey);
      console.log(`正在测试 provider: ${providerKey}`);
      try {
        const chatModel = providerInstance.getChatModal("gpt-4o-mini", 0.7);
        await chatModel.invoke("hello");
        console.log(`  ${providerKey}: Chat 模型实例创建成功。`);
      } catch (error) {
        console.error(`  ${providerKey}: Chat 模型实例创建失败：`, error);
      }
      try {
        const embeddingModel = providerInstance.getEmbeddingModal(
          "text-embedding-3-large",
        ).Embeddings;
        await embeddingModel.embedDocuments(["hello world"]);
        console.log(`  ${providerKey}: Embedding 模型实例创建成功。`);
      } catch (error) {
        console.error(`  ${providerKey}: Embedding 模型实例创建失败：`, error);
      }
    } catch (error) {
      console.error(`  ${providerKey}: Provider 实例创建失败：`, error);
    }
  });
}

if (!process.env.NOTE_COLLECTION_NAME) {
  throw new Error("NOTE_COLLECTION_NAME 环境变量未提供！");
}

let llmprovider: LLMProvider | null = null;

function getLLMProvider(): LLMProvider {
  if (!llmprovider) {
    if (!process.env.NOTE_COLLECTION_NAME) {
      throw new Error("NOTE_COLLECTION_NAME 环境变量未提供！");
    }
    llmprovider = new LLMProvider(
      new provide_zhizeng(),
      process.env.NOTE_COLLECTION_NAME,
    );
  }
  return llmprovider;
}

export const embeddings = () => getLLMProvider().provider.getEmbeddingModal(
  "text-embedding-3-large",
);

export const getEmbeddings = () => getLLMProvider().provider.getEmbeddingModal;

export const getChatModel = () => getLLMProvider().provider.getChatModal;
