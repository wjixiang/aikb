#!/usr/bin/env node
/**
 * PubMed Sync CLI
 *
 * Usage:
 *   node sync.cli.js /path/to/pubmed/xml
 *   node sync.cli.js /path/to/pubmed/xml --batch-size 1000 --concurrency 4
 *
 * Sharding:
 *   node sync.cli.js /path --shard-index 0 --shard-count 4   # 4 containers, this is shard 0
 *
 * Merge:
 *   node sync.cli.js --mode merge --source-dbs "postgres://user:pass@host1:5432/db,postgres://..."
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
  shardIndex: number;
  shardCount: number;
  mode: 'sync' | 'merge';
  sourceDbs: string[];
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    path: '',
    batchSize: 500,
    concurrency: 1,
    shardIndex: 0,
    shardCount: 1,
    mode: 'sync',
    sourceDbs: [],
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
    } else if (arg === '--shard-index' || arg === '-i') {
      const idx = parseInt(argv[++i], 10);
      if (!isNaN(idx) && idx >= 0) {
        args.shardIndex = idx;
      }
    } else if (arg === '--shard-count' || arg === '-n') {
      const count = parseInt(argv[++i], 10);
      if (!isNaN(count) && count > 0) {
        args.shardCount = count;
      }
    } else if (arg === '--mode') {
      const mode = argv[++i];
      if (mode === 'sync' || mode === 'merge') {
        args.mode = mode;
      }
    } else if (arg === '--source-dbs' || arg === '-s') {
      const dbs = argv[++i];
      if (dbs) {
        args.sourceDbs = dbs.split(',').map(s => s.trim()).filter(Boolean);
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
  npm run sync -- --mode merge --source-dbs "url1,url2,..."

Arguments:
  path              Path to PubMed XML directory or file

Options:
  --batch-size, -b    Batch size for database operations (default: 500)
  --concurrency, -c   Number of files to process in parallel (default: 1)

Sharding Options:
  --shard-index, -i   Shard index (0, 1, 2, ...) (default: 0)
  --shard-count, -n    Total number of shards (default: 1)

Merge Options:
  --mode              Mode: sync or merge (default: sync)
  --source-dbs, -s    Comma-separated list of source database URLs for merge

  --help, -h         Show this help message

Examples:
  # Single container sync
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026

  # 4 containers parallel sync
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026 --shard-index 0 --shard-count 4
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026 --shard-index 1 --shard-count 4
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026 --shard-index 2 --shard-count 4
  npm run sync -- /mnt/disk1/pubmed-mirror/baseline/2026 --shard-index 3 --shard-count 4

  # Merge from multiple shard databases
  npm run sync -- --mode merge --source-dbs "postgres://user:pass@host1:5432/db,postgres://user:pass@host2:5432/db"
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Handle merge mode
  if (args.mode === 'merge') {
    if (args.sourceDbs.length === 0) {
      console.error('Error: --source-dbs is required for merge mode');
      process.exit(1);
    }
    await runMerge(args);
    return;
  }

  // Sync mode requires a path
  if (!args.path) {
    printHelp();
    process.exit(1);
  }

  // Check if path is a file or directory
  const pathStat = await stat(args.path);
  const isFile = pathStat.isFile();

  const shardInfo = args.shardCount > 1 ? ` [shard ${args.shardIndex}/${args.shardCount}]` : '';
  console.log(`Sync: ${args.path} (batch: ${args.batchSize}, concurrent: ${args.concurrency})${shardInfo}`);

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
        shardIndex: args.shardIndex,
        shardCount: args.shardCount,
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

async function runMerge(args: CliArgs) {
  console.log(`Merge: ${args.sourceDbs.length} source databases`);

  // Import merge service dynamically to avoid circular dependencies
  const { MergeService } = await import('../merge/merge.service.js');
  const { MergeModule } = await import('../merge/merge.module.js');

  const app = await NestFactory.createApplicationContext(MergeModule, {
    logger: ['error', 'warn', 'log'],
  });

  const mergeService = app.get(MergeService);

  const startTime = Date.now();
  const result = await mergeService.mergeFromShards(args.sourceDbs);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${result.journals} journals, ${result.authors} authors, ${result.articles} articles merged (${totalTime}s)`);

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
