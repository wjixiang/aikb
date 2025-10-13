#!/usr/bin/env node

// Simple worker startup script
// This script starts all PDF processing workers using a simplified approach

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const logger = {
  info: (msg) => console.log(`[WorkerStarter] ${msg}`),
  error: (msg) => console.error(`[WorkerStarter] ${msg}`),
  warn: (msg) => console.warn(`[WorkerStarter] ${msg}`)
};

// Worker configurations
const workers = [
  {
    name: 'PDF Analysis Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts',
    description: 'Analyzes PDF files to determine processing requirements'
  },
  {
    name: 'PDF Processing Coordinator Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts',
    description: 'Coordinates the PDF processing workflow'
  },
  {
    name: 'PDF Conversion Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts',
    description: 'Converts PDF files to Markdown format'
  },
  {
    name: 'Markdown Storage Worker',
    script: 'knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts',
    description: 'Stores Markdown content and processes chunks'
  }
];

// Store worker processes
const workerProcesses = [];

/**
 * Start a single worker
 */
function startWorker(workerConfig) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting ${workerConfig.name}...`);
    
    // Use tsx to run TypeScript files
    const args = ['tsx', workerConfig.script];
    const options = {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env }
    };

    // Try pnpm first, then npx
    const command = spawn('pnpm', args, options);
    
    command.stdout.on('data', (data) => {
      console.log(`[${workerConfig.name}] ${data.toString().trim()}`);
    });

    command.stderr.on('data', (data) => {
      console.error(`[${workerConfig.name}] ${data.toString().trim()}`);
    });

    command.on('error', (error) => {
      logger.error(`Failed to start ${workerConfig.name}: ${error.message}`);
      
      // Try with npx if pnpm fails
      logger.info(`Trying to start ${workerConfig.name} with npx...`);
      const npxCommand = spawn('npx', args, options);
      
      npxCommand.stdout.on('data', (data) => {
        console.log(`[${workerConfig.name}] ${data.toString().trim()}`);
      });

      npxCommand.stderr.on('data', (data) => {
        console.error(`[${workerConfig.name}] ${data.toString().trim()}`);
      });

      npxCommand.on('error', (npxError) => {
        logger.error(`Failed to start ${workerConfig.name} with npx: ${npxError.message}`);
        reject(npxError);
      });

      npxCommand.on('close', (code) => {
        if (code !== 0) {
          logger.error(`${workerConfig.name} exited with code ${code}`);
          reject(new Error(`${workerConfig.name} failed to start`));
        } else {
          logger.info(`✅ ${workerConfig.name} started successfully`);
          resolve(npxCommand);
        }
      });

      workerProcesses.push({ name: workerConfig.name, process: npxCommand });
    });

    command.on('close', (code) => {
      if (code !== 0) {
        logger.error(`${workerConfig.name} exited with code ${code}`);
        reject(new Error(`${workerConfig.name} failed to start`));
      } else {
        logger.info(`✅ ${workerConfig.name} started successfully`);
        resolve(command);
      }
    });

    workerProcesses.push({ name: workerConfig.name, process: command });
  });
}

/**
 * Start all workers
 */
async function startAllWorkers() {
  try {
    logger.info('🚀 Starting all PDF processing workers...');
    logger.info(`Found ${workers.length} workers to start`);

    // Start workers sequentially to avoid overwhelming the system
    await Promise.all(workers.map(async(worker)=>{
      try {
        await startWorker(worker);
      } catch (error) {
        logger.error(`Failed to start ${worker.name}: ${error.message}`);
        // Continue with other workers even if one fails
      }
    }))

    // for (const worker of workers) {
    //   try {
    //     await startWorker(worker);
    //   } catch (error) {
    //     logger.error(`Failed to start ${worker.name}: ${error.message}`);
    //     // Continue with other workers even if one fails
    //   }
    // }

    logger.info(`🎉 Workers startup completed. ${workerProcesses.length} workers running.`);
    
    // Display worker information
    console.log('\n📋 Worker Information:');
    workers.forEach(worker => {
      console.log(`  • ${worker.name}: ${worker.description}`);
    });
    
    console.log('\n💡 Press Ctrl+C to stop all workers');

    // Setup graceful shutdown
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`\n🛑 Received ${signal}, shutting down workers...`);
    
    const shutdownPromises = workerProcesses.map(({ name, process }) => {
      return new Promise((resolve) => {
        if (process && !process.killed) {
          logger.info(`Stopping ${name}...`);
          process.kill('SIGTERM');
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (!process.killed) {
              logger.warn(`Force killing ${name}...`);
              process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
    });

    await Promise.all(shutdownPromises);
    logger.info('✅ All workers stopped');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Check if required services are running
 */
async function checkServices() {
  logger.info('🔍 Checking required services...');
  
  // This is a simplified check - in a real implementation,
  // you would check RabbitMQ, Elasticsearch, etc.
  logger.info('⚠️  Service checks skipped - make sure RabbitMQ and Elasticsearch are running');
}

/**
 * Main function
 */
async function main() {
  logger.info('PDF Processing Worker Manager');
  logger.info('================================');
  
  await checkServices();
  await startAllWorkers();
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start worker manager:', error);
    process.exit(1);
  });
}

module.exports = { startAllWorkers };