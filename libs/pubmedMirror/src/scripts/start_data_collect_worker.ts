import { config } from 'dotenv';
import { PubmedService } from 'med_database_portal';
import { getPrismaClient, closePrismaClient } from '../lib/db-storage.js';
import { createArticleRepository } from '../lib/article-repository.js';
import { startDataCollectWorker, BibliographicDataCollectWorker } from '../lib/dataCollectWorker.js';
import { createProxyPoolFromEnv } from '../lib/proxyPool.js';

// Load environment variables
config();

interface WorkerOptions {
    batchSize?: number;
    concurrency?: number;
    minTime?: number;
    maxRetries?: number;
}

/**
 * Parse command line arguments
 */
function parseOptions(): WorkerOptions {
    const options: WorkerOptions = {};

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const nextArg = process.argv[i + 1];

        switch (arg) {
            case '--batch-size':
            case '-b':
                if (nextArg && !isNaN(parseInt(nextArg))) {
                    options.batchSize = parseInt(nextArg);
                    i++;
                }
                break;
            case '--concurrency':
            case '-c':
                if (nextArg && !isNaN(parseInt(nextArg))) {
                    options.concurrency = parseInt(nextArg);
                    i++;
                }
                break;
            case '--min-time':
            case '-m':
                if (nextArg && !isNaN(parseInt(nextArg))) {
                    options.minTime = parseInt(nextArg);
                    i++;
                }
                break;
            case '--max-retries':
            case '-r':
                if (nextArg && !isNaN(parseInt(nextArg))) {
                    options.maxRetries = parseInt(nextArg);
                    i++;
                }
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    return options;
}

/**
 * Print help message
 */
function printHelp() {
    console.log(`
Usage: npx tsx libs/pubmedMirror/src/scripts/start_data_collect_worker.ts [options]

Options:
  -b, --batch-size <number>         Number of articles to fetch per batch (default: 100)
  -c, --concurrency <number>        Number of concurrent requests (default: 5)
  -m, --min-time <milliseconds>     Minimum time between requests (default: 200)
  -r, --max-retries <number>        Maximum number of retries for failed requests (default: 3)
  -h, --help                        Show this help message

Examples:
  # Start with default settings
  npx tsx libs/pubmedMirror/src/scripts/start_data_collect_worker.ts

  # Start with high concurrency for faster processing
  npx tsx libs/pubmedMirror/src/scripts/start_data_collect_worker.ts --concurrency 10 --min-time 100

  # Start with short options
  npx tsx libs/pubmedMirror/src/scripts/start_data_collect_worker.ts -b 50 -c 5 -m 200 -r 3

Description:
  This script starts a worker that automatically fetches detailed article data from PubMed
  for articles that don't have abstract data yet. The worker will continue running until
  all articles are processed or manually stopped with Ctrl+C.

  The worker emits events for progress tracking:
  - started: Worker has started
  - progress: Progress update with current PMID
  - success: Article successfully fetched and stored
  - error: Failed to fetch article
  - batchComplete: Batch processing completed
  - completed: All articles processed
  - stopped: Worker stopped
`);
}

/**
 * Main function to start the data collect worker
 */
async function main() {
    console.log('========================================');
    console.log('PubMed Data Collect Worker');
    console.log('========================================\n');

    // Parse command line options
    const options = parseOptions();

    // Display options
    console.log('Worker Options:');
    console.log(`  Batch Size: ${options.batchSize ?? 100}`);
    console.log(`  Concurrency: ${options.concurrency ?? 5}`);
    console.log(`  Min Time Between Requests: ${options.minTime ?? 20}ms`);
    console.log(`  Max Retries: ${options.maxRetries ?? 3}`);

    // Check for proxy configuration
    const proxyPool = createProxyPoolFromEnv();
    if (proxyPool) {
        console.log(`  Proxy Pool: ${proxyPool.size} proxies configured`);
    }
    console.log();

    // Initialize dependencies
    const prisma = getPrismaClient();
    const pubmedService = new PubmedService();
    const repository = createArticleRepository(prisma);

    // Apply proxy configuration to PubmedService if available
    if (proxyPool) {
        // Create a new axios instance with proxy support
        const proxyAxiosInstance = proxyPool.createAxiosInstance('https://pubmed.ncbi.nlm.nih.gov/');
        pubmedService.axiosClient = proxyAxiosInstance;
    }

    let worker: BibliographicDataCollectWorker | null = null;

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
        console.log(`\n${signal} received. Stopping worker gracefully...`);
        if (worker) {
            worker.stop();
        }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    try {
        // Start the worker
        worker = await startDataCollectWorker(pubmedService, repository, options);

        // The worker will run until all articles are processed or stopped
        // Wait for worker to complete
        await new Promise<void>((resolve) => {
            worker!.once('completed', () => resolve());
            worker!.once('stopped', () => resolve());
        });

    } catch (error) {
        console.error('Error starting worker:', error);
        process.exit(1);
    } finally {
        // Close Prisma client connection
        await closePrismaClient();
        console.log('\nDatabase connection closed.');
    }
}

main();
