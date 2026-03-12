#!/usr/bin/env node
/**
 * PubMed Embed CLI
 *
 * Usage:
 *   node embed.cli.js --model text-embedding-v4 --batch
 */

import 'dotenv/config';
import { EmbedService } from '../embed/embed.service.js';
import { EmbedModule } from '../embed/embed.module.js';
import { NestFactory } from '@nestjs/core';
import { EmbeddingProvider } from '@ai-embed/core';

interface CliArgs {
  provider: string;
  model: string;
  dimension: number;
  batchSize: number;
  textField: 'title' | 'titleAndAbstract' | 'titleAndMesh';
  rebuild: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    provider: 'alibaba',
    model: 'text-embedding-v4',
    dimension: 1024,
    batchSize: 20,
    textField: 'title',
    rebuild: false,
    help: false,
  };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--provider' || arg === '-p') {
      args.provider = argv[++i] || 'alibaba';
    } else if (arg === '--model' || arg === '-m') {
      args.model = argv[++i] || 'text-embedding-v4';
    } else if (arg === '--dimension' || arg === '-d') {
      args.dimension = parseInt(argv[++i], 10) || 1024;
    } else if (arg === '--batch-size' || arg === '-b') {
      args.batchSize = parseInt(argv[++i], 10) || 20;
    } else if (arg === '--text-field' || arg === '-t') {
      const field = argv[++i];
      if (field === 'title' || field === 'titleAndAbstract' || field === 'titleAndMesh') {
        args.textField = field;
      }
    } else if (arg === '--rebuild' || arg === '-r') {
      args.rebuild = true;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
PubMed Embed CLI

Usage:
  npm run embed -- [options]

Options:
  --provider, -p       Embedding provider (default: alibaba)
                      Options: openai, alibaba, onnx
  --model, -m         Embedding model (default: text-embedding-v4)
  --dimension, -d     Embedding dimension (default: 1024)
  --batch-size, -b    Batch size for embedding (default: 20)
  --text-field, -t    Text to embed (default: title)
                      Options: title, titleAndAbstract, titleAndMesh
  --rebuild, -r       Rebuild existing embeddings
  --help, -h          Show this help message

Examples:
  npm run embed -- --model text-embedding-v4
  npm run embed -- --provider alibaba --model text-embedding-v4 --batch-size 50
  npm run embed -- --rebuild --model text-embedding-v4
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('Starting PubMed embedding...');
  console.log(`Provider: ${args.provider}`);
  console.log(`Model: ${args.model}`);
  console.log(`Dimension: ${args.dimension}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Text field: ${args.textField}`);
  console.log(`Rebuild: ${args.rebuild}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(EmbedModule, {
    logger: ['error', 'warn', 'log'],
  });

  const embedService = app.get(EmbedService);

  const startTime = Date.now();

  const options = {
    provider: args.provider as EmbeddingProvider,
    model: args.model,
    dimension: args.dimension,
    batchSize: args.batchSize,
    textField: args.textField,
  };

  const progress = args.rebuild
    ? await embedService.rebuildEmbeddings(options, (p) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[${elapsed}s] Progress: ${p.processedArticles}/${p.totalArticles}, ` +
          `Embedded: ${p.embeddedArticles}, Errors: ${p.errors}`,
        );
      })
    : await embedService.embedArticlesBatch(options, (p) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[${elapsed}s] Progress: ${p.processedArticles}/${p.totalArticles}, ` +
          `Embedded: ${p.embeddedArticles}, Errors: ${p.errors}`,
        );
      });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('=== Embed Complete ===');
  console.log(`Total articles: ${progress.totalArticles}`);
  console.log(`Embedded: ${progress.embeddedArticles}`);
  console.log(`Errors: ${progress.errors}`);
  console.log(`Time: ${totalTime}s`);

  await app.close();

  process.exit(progress.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
