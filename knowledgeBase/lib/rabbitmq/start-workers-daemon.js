#!/usr/bin/env node

// Worker Daemon Starter
// This script starts workers as detached processes that continue running after the main script exits

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const logger = {
  info: (msg) => console.log(`[WorkerDaemon] ${msg}`),
  error: (msg) => console.error(`[WorkerDaemon] ${msg}`),
  warn: (msg) => console.warn(`[WorkerDaemon] ${msg}`),
  success: (msg) => console.log(`✅ [WorkerDaemon] ${msg}`),
  fail: (msg) => console.log(`❌ [WorkerDaemon] ${msg}`)
};

// Worker configurations
const workers = [
  {
    name: 'PDF Analysis Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts',
    logFile: 'pdf-analysis-worker.log',
    description: 'Analyzes PDF files to determine processing requirements'
  },
  {
    name: 'PDF Processing Coordinator Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts',
    logFile: 'pdf-processing-coordinator-worker.log',
    description: 'Coordinates the PDF processing workflow'
  },
  {
    name: 'PDF Conversion Worker',
    script: 'knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts',
    logFile: 'pdf-conversion-worker.log',
    description: 'Converts PDF files to Markdown format'
  },
  {
    name: 'Markdown Storage Worker',
    script: 'knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts',
    logFile: 'markdown-storage-worker.log',
    description: 'Stores Markdown content and processes chunks'
  }
];

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Start a single worker as a detached process
 */
function startWorker(workerConfig) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting ${workerConfig.name} as detached process...`);
    
    const logFilePath = path.join(logsDir, workerConfig.logFile);
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    
    // Use tsx to run TypeScript files
    const args = ['tsx', workerConfig.script];
    const options = {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env }
    };

    // Try pnpm first, then npx
    const workerProcess = spawn('pnpm', args, options);
    
    // Redirect output to log file
    workerProcess.stdout.pipe(logStream);
    workerProcess.stderr.pipe(logStream);
    
    // Also output to console for initial startup
    workerProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[${workerConfig.name}] ${message}`);
      }
    });
    
    workerProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[${workerConfig.name}] ${message}`);
      }
    });
    
    workerProcess.on('error', (error) => {
      logger.error(`Failed to start ${workerConfig.name} with pnpm: ${error.message}`);
      
      // Try with npx if pnpm fails
      logger.info(`Trying to start ${workerConfig.name} with npx...`);
      const npxProcess = spawn('npx', args, options);
      
      npxProcess.stdout.pipe(logStream);
      npxProcess.stderr.pipe(logStream);
      
      npxProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.log(`[${workerConfig.name}] ${message}`);
        }
      });
      
      npxProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.error(`[${workerConfig.name}] ${message}`);
        }
      });
      
      npxProcess.on('error', (npxError) => {
        logger.error(`Failed to start ${workerConfig.name} with npx: ${npxError.message}`);
        reject(npxError);
      });
      
      npxProcess.on('spawn', () => {
        logger.success(`${workerConfig.name} started with npx (PID: ${npxProcess.pid})`);
        npxProcess.unref(); // Allow parent to exit
        resolve({ name: workerConfig.name, pid: npxProcess.pid, process: npxProcess });
      });
    });
    
    workerProcess.on('spawn', () => {
      logger.success(`${workerConfig.name} started with pnpm (PID: ${workerProcess.pid})`);
      workerProcess.unref(); // Allow parent to exit
      resolve({ name: workerConfig.name, pid: workerProcess.pid, process: workerProcess });
    });
  });
}

/**
 * Start all workers as detached processes
 */
async function startAllWorkers() {
  try {
    logger.info('🚀 Starting all PDF processing workers as detached processes...');
    logger.info(`Found ${workers.length} workers to start`);
    logger.info(`Logs will be written to: ${logsDir}`);

    const startedWorkers = [];
    
    // Start all workers
    for (const worker of workers) {
      try {
        const workerInfo = await startWorker(worker);
        startedWorkers.push(workerInfo);
      } catch (error) {
        logger.error(`Failed to start ${worker.name}: ${error.message}`);
        // Continue with other workers even if one fails
      }
    }

    logger.info(`🎉 Workers startup completed. ${startedWorkers.length} workers started as detached processes.`);
    
    // Display worker information
    console.log('\n📋 Worker Information:');
    startedWorkers.forEach(worker => {
      console.log(`  • ${worker.name}: PID ${worker.pid}`);
    });
    
    console.log('\n📁 Log Files:');
    workers.forEach(worker => {
      const logFilePath = path.join(logsDir, worker.logFile);
      console.log(`  • ${worker.name}: ${logFilePath}`);
    });
    
    console.log('\n💡 Workers are now running in the background.');
    console.log('💡 Use the following commands to manage workers:');
    console.log('   - Check status: pnpm check:workers');
    console.log('   - View logs: tail -f logs/[worker-name].log');
    console.log('   - Stop workers: pnpm stop:workers');
    
    // Save PID file for later management
    const pidFile = path.join(process.cwd(), '.worker-pids.json');
    fs.writeFileSync(pidFile, JSON.stringify(startedWorkers, null, 2));
    logger.info(`Worker PIDs saved to: ${pidFile}`);

  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  logger.info('PDF Processing Worker Daemon');
  logger.info('==============================');
  
  await startAllWorkers();
  
  // Exit the main process, leaving workers running
  logger.info('Daemon process exiting - workers will continue running in background');
  process.exit(0);
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
    logger.error('Failed to start worker daemon:', error);
    process.exit(1);
  });
}

module.exports = { startAllWorkers };