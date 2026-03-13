#!/usr/bin/env node
/**
 * PubMed Sync CLI
 *
 * Usage:
 *   node sync.cli.js /path/to/pubmed/xml
 *   node sync.cli.js /path/to/pubmed/xml --batch-size 1000 --concurrency 4
 */

import 'dotenv/config';
import { stat } from 'node:fs/promises';
import { SyncService } from '../sync.service.js';
import { SyncModule } from '../sync.module.js';
import { NestFactory } from '@nestjs/core';

interface CliArgs {
  path: string;
  batchSize: number;
  concurrency: number;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    path: '',
    batchSize: 500,
    concurrency: 1,
    help: false,
  };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--batch-size' || arg === '-b') {
      const size = parseInt(argv[++i], 10);
      if (!isNaN(size) && size > 0) {
        args.batchSize = size;
      }
    } else if (arg === '--concurrency' || arg === '-c') {
      const size = parseInt(argv[++i], 10);
      if (!isNaN(size) && size > 0) {
        args.concurrency = size;
      }
    } else if (!arg.startsWith('--')) {
      args.path = arg;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
PubMed Sync CLI

Usage:
  npm run sync -- <path> [options]

Arguments:
  path              Path to PubMed XML directory or file

Options:
  --batch-size, -b    Batch size for database operations (default: 500)
  --concurrency, -c   Number of files to process in parallel (default: 1)
  --help, -h         Show this help message

Examples:
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026 --batch-size 2000 --concurrency 4
  npm run sync -- /path/to/pubmed.xml.gz --batch-size 500
`);
}

async function main() {
  const args = parseArgs();

  if (args.help || !args.path) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // Check if path is a file or directory
  const pathStat = await stat(args.path);
  const isFile = pathStat.isFile();

  console.log(`Sync: ${args.path} (batch: ${args.batchSize}, concurrent: ${args.concurrency})`);

  const app = await NestFactory.createApplicationContext(SyncModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(SyncService);

  const startTime = Date.now();

  const progress = isFile
    ? await syncService.syncFile(args.path, {
        batchSize: args.batchSize,
        onProgress: (p) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(
            `[${elapsed}s] ${p.processedArticles}/${p.totalArticles} articles (${p.errors} errors)`,
          );
        },
      })
    : await syncService.syncFromDirectory(args.path, {
        batchSize: args.batchSize,
        concurrency: args.concurrency,
        onProgress: (p) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(
            `[${elapsed}s] ${p.processedFiles}/${p.totalFiles} files, ${p.processedArticles} articles`,
          );
        },
      });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${progress.totalFiles} files, ${progress.totalArticles} articles, ${progress.errors} errors (${totalTime}s)`);

  await app.close();

  process.exit(progress.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
