#!/usr/bin/env node
/**
 * Medical Review Generation CLI
 *
 * Usage:
 *   pnpm tsx scripts/review-cli.ts --input lib/zj-new.xlsx --topic "Lumbar Disc Herniation"
 */

import { program } from 'commander';
import * as path from 'path';
import {
  generateReview,
  formatReviewAsMarkdown,
  type ReviewOptions,
  type ReviewResult,
} from '../lib/generate-review.js';

// Parse command line arguments
program
  .name('review-cli')
  .description('Generate medical narrative review from Excel literature data')
  .version('1.0.0')
  .requiredOption('-i, --input <file>', 'Input Excel file path')
  .requiredOption('-t, --topic <topic>', 'Review topic/title')
  .option('-o, --output <file>', 'Output markdown file path', 'review.md')
  .option(
    '-s, --sections <sections>',
    'Comma-separated list of sections',
    'Introduction,Epidemiology,Pathophysiology,Diagnosis,Treatment,Prognosis,Conclusions',
  )
  .option('--biblib-url <url>', 'bib-lib server URL', 'http://localhost:3000')
  .option(
    '--embedding-provider <provider>',
    'Embedding provider',
    'alibaba',
  )
  .option('--embedding-model <model>', 'Embedding model', 'text-embedding-v4')
  .option('--batch-size <size>', 'Import batch size', '10')
  .option('--max-articles <count>', 'Maximum articles to process', '100')
  .option('--skip-import', 'Skip import, only generate review from existing data', false)
  .option('--dry-run', 'Only read Excel, do not import or generate', false)
  .parse(process.argv);

const options = program.opts();

// Progress callback
function onProgress(message: string): void {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] ${message}`);
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Medical Review Generator');
  console.log('='.repeat(60));
  console.log('');

  // Resolve input path
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Topic: ${options.topic}`);
  console.log(`Sections: ${options.sections}`);
  console.log(`bib-lib URL: ${options.biblibUrl}`);
  console.log('');

  if (options.dryRun) {
    console.log('DRY RUN MODE - Only reading Excel file');
    const { readLiteratureExcel } = await import('../lib/generate-review.js');
    const articles = await readLiteratureExcel(
      inputPath,
      parseInt(options.maxArticles),
    );
    console.log(`Found ${articles.length} articles`);
    console.log('Sample article:');
    console.log(JSON.stringify(articles[0], null, 2));
    return;
  }

  try {
    // Generate review
    const reviewOptions: ReviewOptions = {
      excelPath: inputPath,
      topic: options.topic,
      sections: options.sections.split(',').map((s: string) => s.trim()),
      outputPath,
      biblibUrl: options.biblibUrl,
      embeddingProvider: options.embeddingProvider,
      embeddingModel: options.embeddingModel,
      batchSize: parseInt(options.batchSize),
      maxArticles: parseInt(options.maxArticles),
      skipImport: options.skipImport,
      onProgress,
    };

    const result = await generateReview(reviewOptions);

    console.log('');
    console.log('='.repeat(60));
    console.log('Review Generation Complete!');
    console.log('='.repeat(60));
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Total articles: ${result.metadata.totalArticles}`);
    console.log(`Imported articles: ${result.metadata.importedArticles}`);
    console.log(`Sections generated: ${result.sections.length}`);
  } catch (error) {
    console.error('Error generating review:', error);
    process.exit(1);
  }
}

main();
