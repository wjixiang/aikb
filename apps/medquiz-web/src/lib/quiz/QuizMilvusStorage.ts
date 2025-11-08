import { createLoggerWithPrefix } from '../console/logger';
import { quiz } from '@/types/quizData.types';
import pLimit from 'p-limit';
import QuizStorage from './QuizStorage';
import { embedding } from '@/kgrag/lib/embedding';
import { quizSelector } from '@/types/quizSelector.types';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

export interface QuizMilvusStorageConfig {
  semantic_search_threshold: number;
  milvusCollectionName?: string;
}

interface QuizMilvusRecord {
  oid: string;
  content: string;
  cls: string;
  mode: string;
  source: string;
  embedding: number[];
  createdAt: number;
}

export default class QuizMilvusStorage extends QuizStorage {
  logger = createLoggerWithPrefix('QuizMilvusStorage');
  config: QuizMilvusStorageConfig;
  milvusClient!: MilvusClient;
  collectionName: string;
  private initialized = false;

  constructor(config: QuizMilvusStorageConfig) {
    super();
    this.config = config;
    this.collectionName = config.milvusCollectionName || 'quiz';
    // The constructor cannot be async, so we call an async initialization method
    // and rely on subsequent method calls to await its completion.
    // This is a common pattern for services that need async setup.
    this.ensureInitialized();
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      if (!process.env.MILVUS_URI) {
        throw new Error('MILVUS_URI environment variable is required');
      }

      this.milvusClient = new MilvusClient({
        address: process.env.MILVUS_URI,
        username: process.env.MILVUS_USERNAME,
        password: process.env.MILVUS_PASSWORD,
        ssl: process.env.MILVUS_URI.startsWith('https'),
      });

      // Ensure collection exists
      const exists = await this.milvusClient.hasCollection({
        collection_name: this.collectionName,
      });

      if (!exists.value) {
        this.logger.info(
          `Collection ${this.collectionName} does not exist. Creating...`,
        );
        await this.milvusClient.createCollection({
          collection_name: this.collectionName,
          fields: [
            {
              name: 'oid',
              data_type: 'VarChar',
              is_primary_key: true,
              max_length: 100,
            },
            {
              name: 'content',
              data_type: 'VarChar',
              max_length: 10000,
            },
            {
              name: 'cls',
              data_type: 'VarChar',
              max_length: 100,
            },
            {
              name: 'mode',
              data_type: 'VarChar',
              max_length: 10,
            },
            {
              name: 'source',
              data_type: 'VarChar',
              max_length: 500,
            },
            {
              name: 'embedding',
              data_type: 'FloatVector',
              dim: 1024, // Adjust based on your embedding dimension
            },
            {
              name: 'createdAt',
              data_type: 'Int64',
            },
          ],
        });

        await this.milvusClient.createIndex({
          collection_name: this.collectionName,
          field_name: 'embedding',
          index_name: 'embedding_index',
          index_type: 'IVF_FLAT',
          metric_type: 'COSINE',
          params: { nlist: 1024 },
        });
        this.logger.info(
          `Collection ${this.collectionName} created and indexed.`,
        );
      } else {
        this.logger.info(`Collection ${this.collectionName} already exists.`);
      }

      // Check and load collection if not loaded
      const loadState = await this.milvusClient.getLoadState({
        collection_name: this.collectionName,
      });

      if (loadState.state !== 'LoadStateLoaded') {
        this.logger.info(
          `Collection ${this.collectionName} not loaded. Loading...`,
        );
        await this.milvusClient.loadCollection({
          collection_name: this.collectionName,
        });
        this.logger.info(`Collection ${this.collectionName} loaded.`);
      } else {
        this.logger.info(`Collection ${this.collectionName} already loaded.`);
      }
      this.initialized = true;
    }
  }

  private async getEmbedding(content: string): Promise<number[]> {
    await this.ensureInitialized(); // Ensure Milvus client is initialized and collection exists
    const embedResult = await embedding(content);
    if (!embedResult || !Array.isArray(embedResult)) {
      throw new Error('Failed to generate embedding');
    }
    // Ensure we always return a 1D array
    return embedResult.flat();
  }

  async importQuizzesToMilvus(quizzes: quiz[]): Promise<void> {
    await this.ensureInitialized(); // Ensure Milvus client is initialized and collection exists
    this.logger.info(`Importing ${quizzes.length} quizzes to Milvus`);
    const limit = pLimit(5);

    await Promise.all(
      quizzes.map((quiz) =>
        limit(async () => {
          try {
            const embedResult = await this.getEmbedding(
              QuizStorage.formQuizContent(quiz, true, true),
            );

            const record = {
              oid: quiz._id.toString(),
              content: QuizStorage.formQuizContent(quiz, true, true),
              cls: quiz.class,
              mode: 'A1', // Default mode
              source: quiz.source,
              embedding: embedResult,
              createdAt: Date.now(),
            };

            await this.milvusClient.insert({
              collection_name: this.collectionName,
              data: [record],
            });

            this.logger.debug(`Imported quiz ${quiz._id} to Milvus`);
          } catch (error) {
            this.logger.error(
              `Error importing quiz ${quiz._id} to Milvus: ${error}`,
            );
          }
        }),
      ),
    );

    this.logger.info('Finished importing quizzes to Milvus');
  }

  async batch_embed_quiz(quizzes: quiz[]): Promise<void> {
    await this.ensureInitialized();
    const limit = pLimit(5);

    await Promise.all(
      quizzes.map((quiz) =>
        limit(async () => {
          try {
            const embedResult = await this.getEmbedding(
              QuizStorage.formQuizContent(quiz, true, true),
            );

            await this.milvusClient.upsert({
              collection_name: this.collectionName,
              data: [
                {
                  oid: quiz._id.toString(),
                  embedding: embedResult,
                },
              ],
            });

            this.logger.debug(`Updated embedding for quiz ${quiz._id}`);
          } catch (error) {
            this.logger.error(`Failed to embed quiz ${quiz._id}: ${error}`);
          }
        }),
      ),
    );
  }

  async syncQuizzesWithSelector(selector: quizSelector): Promise<void> {
    await this.ensureInitialized();
    this.logger.info(
      `Syncing quizzes with selector: ${JSON.stringify(selector)}`,
    );
    const cursor = await this.fetchQuizzesWithCursor(selector);
    const limit = pLimit(5);
    const batchSize = 100;

    let quizzesProcessed = 0;
    let newQuizzesSynced = 0;

    while (await cursor.hasNext()) {
      const batch: (quiz & { __v: any })[] = [];
      for (let i = 0; i < batchSize && (await cursor.hasNext()); i++) {
        const quiz = await cursor.next();
        if (quiz) {
          batch.push(quiz);
        }
      }

      if (batch.length === 0) {
        continue;
      }

      this.logger.debug(`Processing batch of ${batch.length} quizzes.`);

      const results = await Promise.all(
        batch.map((quiz) =>
          limit(async () => {
            try {
              const exists = await this.milvusClient.query({
                collection_name: this.collectionName,
                expr: `oid == "${quiz._id.toString()}"`,
                output_fields: ['oid'],
                limit: 1,
              });

              if (exists.data.length === 0) {
                const embedResult = await this.getEmbedding(
                  QuizStorage.formQuizContent(quiz, true, true),
                );

                const milvus_res = await this.milvusClient.insert({
                  collection_name: this.collectionName,
                  data: [
                    {
                      oid: quiz._id.toString(),
                      content: QuizStorage.formQuizContent(quiz, true, true),
                      cls: quiz.class,
                      mode: 'A1', // Default mode
                      source: quiz.source,
                      embedding: embedResult,
                      createdAt: Date.now(),
                    },
                  ],
                });

                this.logger.debug(JSON.stringify(milvus_res, null, 2));
                this.logger.debug(`Synced quiz ${quiz._id} to Milvus`);
                return 'synced';
              } else {
                this.logger.debug(
                  `Quiz ${quiz._id} already exists in Milvus, skipping`,
                );
                return 'skipped';
              }
            } catch (error) {
              this.logger.error(`Error syncing quiz ${quiz._id}: ${error}`);
              return 'failed';
            }
          }),
        ),
      );

      quizzesProcessed += batch.length;
      newQuizzesSynced += results.filter(
        (result) => result === 'synced',
      ).length;
    }

    this.logger.info(
      `Finished syncing. Processed ${quizzesProcessed} quizzes, synced ${newQuizzesSynced} new quizzes to Milvus with embeddings.`,
    );
  }

  async semanticQuizRetriever(
    quiz: quiz,
    top_k: number,
    quizClass?: string,
    quizSource?: string,
  ): Promise<quiz[]> {
    await this.ensureInitialized();
    try {
      const queryEmbedding = await this.getEmbedding(
        QuizStorage.formQuizContent(quiz, true, true),
      );

      let expr = '';
      if (quizClass) expr += `cls == "${quizClass}"`;
      if (quizSource) {
        if (expr) expr += ' && ';
        expr += `source == "${quizSource}"`;
      }
      await this.ensureInitialized(); // Ensure Milvus client is initialized
      const searchResults = await this.milvusClient.search({
        collection_name: this.collectionName,
        data: [queryEmbedding],
        output_fields: ['oid', 'cls', 'mode', 'source'],
        limit: top_k,
        expr,
        metric_type: 'COSINE',
        params: { nprobe: 10 },
      });

      this.logger.debug(JSON.stringify(searchResults, null, 2));

      const quizes: quiz[] = await this.fetchQuizzesByOids(
        searchResults.results.map((e) => e.oid),
      );

      return quizes;
    } catch (error) {
      this.logger.error('Error during quiz query:', error);
      throw error;
    }
  }
}
