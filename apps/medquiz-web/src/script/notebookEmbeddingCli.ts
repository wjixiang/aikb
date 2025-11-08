#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import TextFileEmbedding from '@/kgrag/notebookEmbedding';

interface ProcessArgs {
  file?: string;
  dir?: string;
  collection: string;
  chunkSize: number;
  chunkOverlap: number;
}

interface SearchArgs {
  query: string;
  collection: string;
  limit: number;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .parserConfiguration({
      'unknown-options-as-args': true,
    })
    .scriptName('notebook-embedding')
    .usage('$0 <cmd> [args]')
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Enable verbose output including Milvus configuration',
    })
    .command('process', 'Process text files for embedding', (yargs) => {
      return yargs
        .option('file', {
          alias: 'f',
          type: 'string',
          description: 'Path to a single text file to process',
        })
        .option('dir', {
          alias: 'd',
          type: 'string',
          description: 'Path to a directory containing text files to process',
        })
        .option('collection', {
          alias: 'c',
          type: 'string',
          required: true,
          description: 'Milvus collection name',
        })
        .option('chunkSize', {
          type: 'number',
          default: 1000,
          description: 'Chunk size for text splitting',
        })
        .option('chunkOverlap', {
          type: 'number',
          default: 200,
          description: 'Chunk overlap for text splitting',
        })
        .check((argv) => {
          if (!argv.file && !argv.dir) {
            throw new Error('Either --file or --dir must be specified');
          }
          return true;
        });
    })
    .command('search', 'Search in embedded collection', (yargs) => {
      return yargs
        .option('query', {
          alias: 'q',
          type: 'string',
          required: true,
          description: 'Search query text',
        })
        .option('collection', {
          alias: 'c',
          type: 'string',
          required: true,
          description: 'Milvus collection name',
        })
        .option('limit', {
          alias: 'l',
          type: 'number',
          default: 5,
          description: 'Maximum number of results to return',
        });
    })
    .demandCommand(1, 'You need to specify a command')
    .help().argv;

  try {
    // Debug mode output
    if (argv.verbose) {
      console.debug('[notebookEmbeddingCli] Milvus connection config:', {
        uri: process.env.MILVUS_URI,
        timeout: process.env.MILVUS_CLIENT_TIMEOUT || '30000',
        username: process.env.MILVUS_USERNAME ? '*****' : 'not set',
        password: process.env.MILVUS_PASSWORD ? '*****' : 'not set',
        token: process.env.TOKEN ? '*****' : 'not set',
      });
    }

    if (argv._.includes('process')) {
      const args = argv as unknown as ProcessArgs;
      const embedder = new TextFileEmbedding(
        args.collection,
        args.chunkSize,
        args.chunkOverlap,
      );

      if (args.file) {
        await embedder.processTextFile(args.file, {
          partition: path.basename(args.file).replace('.txt', ''),
          source: 'notebook',
        });
      } else if (args.dir) {
        await embedder.processDirectory(args.dir, args.collection);
      }
    } else if (argv._.includes('search')) {
      const args = argv as unknown as SearchArgs;
      const embedder = new TextFileEmbedding(args.collection);
      const results = await embedder.searchByText(args.query, args.limit);

      console.log('\nSearch Results:');
      console.log('='.repeat(50));
      results.documents.forEach((doc, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`- Title: ${doc.title}`);
        console.log(`- File: ${doc.fileId}`);
        console.log(`- Content: ${doc.content.substring(0, 200)}...`);
        console.log(`- Score: ${results.distances[index]}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
