#!/usr/bin/env ts-node
import TextbookMilvusStorage from '../kgrag/textbookMilvusStorage';
import type { TextbookMilvusStorageConfig } from '../kgrag/textbookMilvusStorage';
import { config } from 'dotenv';
config();

interface ProcessOptions {
  pdfName: string;
  collection?: string;
  mongoCollection?: string;
}

interface StatsOptions {
  pdfName: string;
  mongoCollection?: string;
}
import { Command } from 'commander';
import dotenv from 'dotenv';
import { createLoggerWithPrefix } from '@/lib/console/logger';
import { connectToDatabase } from '@/lib/db/mongodb';

dotenv.config();

const program = new Command();
const logger = createLoggerWithPrefix('TextbookEmbeddingCLI');

program
  .name('textbook-embedding')
  .description('CLI for processing textbook embeddings into Milvus')
  .version('0.1.0');

program
  .command('process')
  .description('Process a textbook PDF from MongoDB into Milvus')
  .option('-p, --pdf-name <name>', 'Name of the PDF to process')
  .option('-c, --collection <name>', 'Milvus collection name', 'textbooks')
  .option(
    '-m, --mongo-collection <name>',
    'MongoDB collection name',
    'textbook_chunks',
  )
  .action(async (options: ProcessOptions) => {
    try {
      const config: TextbookMilvusStorageConfig = {
        textbook_chunk_mongodb_collection_name:
          options.mongoCollection || 'pdf_pages',
        textbook_milvus_collection_name: options.collection || 'textbooks',
        milvus_collection_name: options.collection || 'textbooks',
        chunk_size: 25,
        chunk_overlap: 200,
        embedding_batch_size: 20,
        milvus_batch_size: 100,
      };

      const storage = new TextbookMilvusStorage(config);
      if (options.pdfName) {
        await storage.processTextbookFromDB(options.pdfName);
      } else {
        const { db } = await connectToDatabase();
        const pdfs = await db.collection('pdf_pages').distinct('pdf_name');
        for await (const element of pdfs) {
          await storage.processTextbookFromDB(element);
        }
      }

      logger.info(`Successfully processed textbook: ${options.pdfName}`);
      process.exit(0);
    } catch (error) {
      logger.error(`Failed to process textbook: ${error}`);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Get statistics for a textbook')
  .requiredOption('-p, --pdf-name <name>', 'Name of the PDF to get stats for')
  .option(
    '-m, --mongo-collection <name>',
    'MongoDB collection name',
    'textbook_chunks',
  )
  .action(async (options: StatsOptions) => {
    try {
      const config: TextbookMilvusStorageConfig = {
        textbook_chunk_mongodb_collection_name:
          options.mongoCollection || 'textbook_chunks',
        textbook_milvus_collection_name: 'textbooks',
        milvus_collection_name: 'textbooks',
        chunk_size: 600,
        chunk_overlap: 100,
      };

      const storage = new TextbookMilvusStorage(config);
      const stats = await storage.getTextbookStats(options.pdfName);

      logger.info(`Textbook Statistics for ${options.pdfName}:`);
      logger.info(`- Page count: ${stats.page_count}`);
      logger.info(`- Character count: ${stats.char_count}`);
      logger.info(`- Average page length: ${stats.avg_page_length} chars`);
      process.exit(0);
    } catch (error) {
      logger.error(`Failed to get textbook stats: ${error}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: Error) => {
  logger.error(`CLI error: ${err}`);
  process.exit(1);
});
