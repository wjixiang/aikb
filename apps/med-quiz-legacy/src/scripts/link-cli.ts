#!/usr/bin/env node
/**
 * CLI script for bidirectional link indexing management
 * Usage: npx tsx src/scripts/link-cli.ts [command] [options]
 */

import { Command } from 'commander';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';
import { LinkStatsService } from '@/kgrag/services/linkStatsService';
import { LinkIntegrationService } from '@/kgrag/services/linkIntegrationService';
import { createLoggerWithPrefix } from '@/lib/console/logger';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

const logger = createLoggerWithPrefix('LinkCLI');
const program = new Command();

// Initialize services
const indexingService = new LinkIndexingService();
const statsService = new LinkStatsService();
const integrationService = new LinkIntegrationService();

// Configure CLI
program
  .name('link-cli')
  .description('Bidirectional link indexing CLI for knowledge base')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the link indexing system')
  .action(async () => {
    const spinner = ora('Initializing link indexing system...').start();
    try {
      await integrationService.initialize();
      spinner.succeed('Link indexing system initialized successfully');
    } catch (error) {
      spinner.fail(`Initialization failed: ${error}`);
      process.exit(1);
    }
  });

// Rebuild index command
program
  .command('rebuild')
  .description('Rebuild the entire link index')
  .option('-f, --force', 'Force rebuild without confirmation')
  .action(async (options) => {
    if (!options.force) {
      console.log(chalk.yellow('⚠️  This will rebuild the entire link index.'));
      console.log(chalk.yellow('   Use --force to skip this confirmation.'));
      return;
    }

    const spinner = ora('Rebuilding link index...').start();
    try {
      const count = await indexingService.rebuildIndex();
      spinner.succeed(`Rebuilt index for ${count} documents`);
    } catch (error) {
      spinner.fail(`Rebuild failed: ${error}`);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Display link statistics')
  .option('-a, --activity', 'Include activity data')
  .option('-d, --days <number>', 'Days for activity data', '30')
  .action(async (options) => {
    const spinner = ora('Fetching link statistics...').start();
    try {
      const stats = await statsService.getLinkStats();
      const activity = options.activity
        ? await statsService.getLinkActivity(parseInt(options.days))
        : null;

      spinner.succeed('Statistics retrieved');

      console.log(chalk.bold('\n📊 Link Statistics'));
      console.log(chalk.gray('─'.repeat(50)));

      // Basic stats
      console.log(chalk.blue('Total Documents:'), stats.totalDocuments);
      console.log(chalk.blue('Total Links:'), stats.totalLinks);
      console.log(chalk.blue('Orphaned Documents:'), stats.orphanedDocuments);
      console.log(
        chalk.blue('Avg Links/Document:'),
        stats.linkDistribution.averageLinksPerDocument.toFixed(2),
      );

      // Most linked documents
      if (stats.mostLinkedDocuments.length > 0) {
        console.log(chalk.bold('\n🏆 Most Linked Documents:'));
        const table = new Table({
          head: ['Title', 'Link Count'],
          colWidths: [30, 15],
        });

        stats.mostLinkedDocuments.slice(0, 5).forEach((doc) => {
          table.push([
            doc.title.substring(0, 27) + (doc.title.length > 27 ? '...' : ''),
            doc.linkCount,
          ]);
        });

        console.log(table.toString());
      }

      // Activity data
      if (activity && activity.length > 0) {
        console.log(chalk.bold('\n📈 Link Activity (last 30 days):'));
        const activityTable = new Table({
          head: ['Date', 'New Links'],
          colWidths: [20, 15],
        });

        activity.slice(-7).forEach((item) => {
          activityTable.push([
            item.date.toISOString().split('T')[0],
            item.count,
          ]);
        });

        console.log(activityTable.toString());
      }
    } catch (error) {
      spinner.fail(`Failed to get stats: ${error}`);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate links in a document or all documents')
  .option('-c, --content <text>', 'Validate specific content')
  .option('-i, --id <documentId>', 'Validate specific document by ID')
  .option('-a, --all', 'Validate all documents')
  .action(async (options) => {
    try {
      if (options.content) {
        // Validate specific content
        const validation = await indexingService.validateLinks(options.content);
        console.log(chalk.bold('\n🔍 Validation Results:'));
        console.log(chalk.blue('Valid:'), validation.valid);
        console.log(chalk.blue('Errors:'), validation.errors.length);
        console.log(chalk.blue('Warnings:'), validation.warnings.length);

        if (validation.brokenLinks.length > 0) {
          console.log(chalk.red('\n❌ Broken Links:'));
          validation.brokenLinks.forEach((link) => {
            console.log(`  - ${link.title} at position ${link.position}`);
          });
        }
      } else if (options.id) {
        // Validate specific document
        const spinner = ora('Validating document...').start();
        try {
          const { connectToDatabase } = await import('@/lib/db/mongodb');
          const { ObjectId } = await import('mongodb');
          const { db } = await connectToDatabase();
          const collection = db.collection('notes');

          const doc = await collection.findOne({
            _id: new ObjectId(options.id),
          });
          if (!doc) {
            spinner.fail('Document not found');
            return;
          }

          const validation = await indexingService.validateLinks(
            doc.content || '',
          );
          spinner.succeed('Validation completed');

          console.log(chalk.bold(`\n📄 Document: ${doc.title || doc.key}`));
          console.log(chalk.blue('Valid:'), validation.valid);
          console.log(
            chalk.blue('Broken Links:'),
            validation.brokenLinks.length,
          );
        } catch (error) {
          spinner.fail(`Validation failed: ${error}`);
        }
      } else if (options.all) {
        // Validate all documents
        const spinner = ora('Validating all documents...').start();
        try {
          const results = await integrationService.validateAllLinks();
          spinner.succeed(`Validated ${results.length} documents`);

          const brokenCount = results.filter((r) => !r.valid).length;
          console.log(chalk.bold(`\n📊 Validation Summary:`));
          console.log(chalk.blue('Total Documents:'), results.length);
          console.log(
            chalk.blue('Valid Documents:'),
            results.length - brokenCount,
          );
          console.log(chalk.blue('Documents with Issues:'), brokenCount);

          if (brokenCount > 0) {
            console.log(chalk.red('\n❌ Documents with Issues:'));
            results
              .filter((r) => !r.valid)
              .forEach((r) => {
                console.log(
                  `  - ${r.title}: ${r.brokenLinks.length} broken links`,
                );
              });
          }
        } catch (error) {
          spinner.fail(`Validation failed: ${error}`);
        }
      } else {
        console.log(chalk.yellow('Please specify --content, --id, or --all'));
      }
    } catch (error) {
      console.error(chalk.red('Validation error:'), error);
      process.exit(1);
    }
  });

// Graph command
program
  .command('graph')
  .description('Display link graph for a document')
  .requiredOption('-i, --id <documentId>', 'Document ID')
  .option('-d, --depth <number>', 'Graph depth (1-3)', '1')
  .action(async (options) => {
    const spinner = ora('Building link graph...').start();
    try {
      const depth = parseInt(options.depth);
      if (depth < 1 || depth > 3) {
        spinner.fail('Depth must be between 1 and 3');
        return;
      }

      const graph = await indexingService.getLinkGraph(options.id);
      spinner.succeed('Link graph built');

      console.log(chalk.bold(`\n🔗 Link Graph for Document: ${options.id}`));
      console.log(chalk.blue('Total Links:'), graph.totalLinks);

      if (graph.forwardLinks.length > 0) {
        console.log(chalk.bold('\n📤 Forward Links:'));
        graph.forwardLinks.forEach((link) => {
          console.log(
            `  → ${link.targetTitle}${link.alias ? ` (${link.alias})` : ''}`,
          );
        });
      }

      if (graph.backwardLinks.length > 0) {
        console.log(chalk.bold('\n📥 Backward Links:'));
        graph.backwardLinks.forEach((link) => {
          console.log(`  ← ${link.sourceTitle}`);
        });
      }
    } catch (error) {
      spinner.fail(`Failed to build graph: ${error}`);
      process.exit(1);
    }
  });

// Orphaned documents command
program
  .command('orphans')
  .description('List orphaned documents (no links)')
  .action(async () => {
    const spinner = ora('Finding orphaned documents...').start();
    try {
      const orphans = await statsService.getOrphanedDocuments();
      spinner.succeed(`Found ${orphans.length} orphaned documents`);

      if (orphans.length > 0) {
        const table = new Table({
          head: ['Document', 'Last Modified'],
          colWidths: [40, 20],
        });

        orphans.slice(0, 10).forEach((doc) => {
          table.push([
            doc.title.substring(0, 37) + (doc.title.length > 37 ? '...' : ''),
            doc.lastModified.toISOString().split('T')[0],
          ]);
        });

        console.log(table.toString());

        if (orphans.length > 10) {
          console.log(chalk.gray(`... and ${orphans.length - 10} more`));
        }
      }
    } catch (error) {
      spinner.fail(`Failed to find orphans: ${error}`);
      process.exit(1);
    }
  });

// Index single document command
program
  .command('index')
  .description('Index links for a specific document')
  .requiredOption('-i, --id <documentId>', 'Document ID')
  .option('-c, --content <text>', 'Document content')
  .option('-t, --title <text>', 'Document title')
  .action(async (options) => {
    const spinner = ora('Indexing document links...').start();
    try {
      let content = options.content;
      let title = options.title;

      if (!content || !title) {
        const { connectToDatabase } = await import('@/lib/db/mongodb');
        const { ObjectId } = await import('mongodb');
        const { db } = await connectToDatabase();
        const collection = db.collection('notes');

        const doc = await collection.findOne({ _id: new ObjectId(options.id) });
        if (!doc) {
          spinner.fail('Document not found');
          return;
        }

        content = doc.content || '';
        title = doc.title || doc.key;
      }

      await indexingService.indexDocument(options.id, content, title);
      spinner.succeed('Document links indexed successfully');
    } catch (error) {
      spinner.fail(`Indexing failed: ${error}`);
      process.exit(1);
    }
  });

// Parse error handling
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.help') {
    // Help was displayed, exit normally
    process.exit(0);
  } else if (err.code === 'commander.version') {
    // Version was displayed, exit normally
    process.exit(0);
  } else {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
