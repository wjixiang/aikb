#!/usr/bin/env node
/**
 * PubMed Sync CLI
 *
 * Usage:
 *   node sync.cli.js /path/to/pubmed/xml
 *   node sync.cli.js /path/to/pubmed/xml --batch-size 50
 */

import 'dotenv/config';
import { stat } from 'node:fs/promises';
import { SyncService } from '../sync.service.js';
import { SyncModule } from '../sync.module.js';
import { NestFactory } from '@nestjs/core';

interface CliArgs {
  path: string;
  batchSize: number;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    path: '',
    batchSize: 100,
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
  --batch-size, -b  Batch size for database operations (default: 100)
  --help, -h       Show this help message

Examples:
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026
  npm run sync -- /path/to/pubmed.xml.gz --batch-size 50
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

  console.log('Starting PubMed sync...');
  console.log(`Path: ${args.path}`);
  console.log(`Type: ${isFile ? 'file' : 'directory'}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(SyncModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(SyncService);

  const startTime = Date.now();

  const progress = isFile
    ? await syncService.syncFile(args.path, {
        batchSize: args.batchSize,
        onProgress: (p) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(
            `[${elapsed}s] Articles: ${p.processedArticles}/${p.totalArticles}, ` +
            `Errors: ${p.errors}`,
          );
        },
      })
    : await syncService.syncFromDirectory(args.path, {
        batchSize: args.batchSize,
        onProgress: (p) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(
            `[${elapsed}s] Files: ${p.processedFiles}/${p.totalFiles}, ` +
            `Articles: ${p.processedArticles}/${p.totalArticles}, ` +
            `Errors: ${p.errors}`,
          );
        },
      });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('=== Sync Complete ===');
  console.log(`Total files: ${progress.totalFiles}`);
  console.log(`Total articles: ${progress.totalArticles}`);
  console.log(`Errors: ${progress.errors}`);
  console.log(`Time: ${totalTime}s`);

  await app.close();

  process.exit(progress.errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
