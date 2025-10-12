#!/usr/bin/env node

// Worker Stopper
// This script stops all running worker processes

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const logger = {
  info: (msg) => console.log(`[WorkerStopper] ${msg}`),
  error: (msg) => console.error(`[WorkerStopper] ${msg}`),
  warn: (msg) => console.warn(`[WorkerStopper] ${msg}`),
  success: (msg) => console.log(`✅ [WorkerStopper] ${msg}`),
  fail: (msg) => console.log(`❌ [WorkerStopper] ${msg}`)
};

/**
 * Stop workers by PID file
 */
function stopWorkersByPidFile() {
  const pidFile = path.join(process.cwd(), '.worker-pids.json');
  
  if (!fs.existsSync(pidFile)) {
    logger.warn('PID file not found, trying alternative methods...');
    return false;
  }
  
  try {
    const workerPids = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    logger.info(`Found PID file with ${workerPids.length} workers`);
    
    const stopPromises = workerPids.map(worker => {
      return new Promise((resolve) => {
        logger.info(`Stopping ${worker.name} (PID: ${worker.pid})...`);
        
        // Try graceful shutdown first
        exec(`kill -TERM ${worker.pid}`, (error, stdout, stderr) => {
          if (error) {
            logger.warn(`Failed to send TERM signal to ${worker.name}: ${error.message}`);
            resolve({ name: worker.name, success: false });
            return;
          }
          
          // Wait a bit and check if process is still running
          setTimeout(() => {
            exec(`kill -0 ${worker.pid}`, (checkError) => {
              if (!checkError) {
                // Process still running, force kill
                logger.warn(`Force killing ${worker.name}...`);
                exec(`kill -KILL ${worker.pid}`, (forceError) => {
                  if (forceError) {
                    logger.error(`Failed to kill ${worker.name}: ${forceError.message}`);
                    resolve({ name: worker.name, success: false });
                  } else {
                    logger.success(`${worker.name} force killed`);
                    resolve({ name: worker.name, success: true });
                  }
                });
              } else {
                logger.success(`${worker.name} stopped gracefully`);
                resolve({ name: worker.name, success: true });
              }
            });
          }, 2000);
        });
      });
    });
    
    return Promise.all(stopPromises);
    
  } catch (error) {
    logger.error(`Failed to read PID file: ${error.message}`);
    return false;
  }
}

/**
 * Find and stop worker processes by name
 */
function stopWorkersByName() {
  return new Promise((resolve) => {
    logger.info('Searching for worker processes...');
    
    // Find all worker processes
    exec('ps aux | grep -E "(tsx|node).*worker" | grep -v grep', (error, stdout, stderr) => {
      if (error || !stdout) {
        logger.info('No worker processes found');
        resolve([]);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const workerProcesses = [];
      
      lines.forEach(line => {
        // Extract PID from ps output
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const pid = parts[1];
          const command = parts.slice(10).join(' ');
          
          // Check if it's a worker process
          if (command.includes('pdf-analysis.worker') ||
              command.includes('pdf-processing-coordinator.worker') ||
              command.includes('pdf-conversion.worker') ||
              command.includes('markdown-storage.worker')) {
            
            let workerName = 'Unknown Worker';
            if (command.includes('pdf-analysis.worker')) workerName = 'PDF Analysis Worker';
            else if (command.includes('pdf-processing-coordinator.worker')) workerName = 'PDF Processing Coordinator Worker';
            else if (command.includes('pdf-conversion.worker')) workerName = 'PDF Conversion Worker';
            else if (command.includes('markdown-storage.worker')) workerName = 'Markdown Storage Worker';
            
            workerProcesses.push({ name: workerName, pid, command });
          }
        }
      });
      
      logger.info(`Found ${workerProcesses.length} worker processes`);
      
      // Stop each process
      const stopPromises = workerProcesses.map(worker => {
        return new Promise((resolve) => {
          logger.info(`Stopping ${worker.name} (PID: ${worker.pid})...`);
          
          exec(`kill -TERM ${worker.pid}`, (killError) => {
            if (killError) {
              logger.warn(`Failed to stop ${worker.name}: ${killError.message}`);
              resolve({ name: worker.name, success: false });
            } else {
              logger.success(`${worker.name} stopped`);
              resolve({ name: worker.name, success: true });
            }
          });
        });
      });
      
      Promise.all(stopPromises).then(resolve);
    });
  });
}

/**
 * Clean up PID file and logs
 */
function cleanup() {
  const pidFile = path.join(process.cwd(), '.worker-pids.json');
  
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      logger.info('PID file removed');
    } catch (error) {
      logger.error(`Failed to remove PID file: ${error.message}`);
    }
  }
  
  // Ask user if they want to remove log files
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Remove log files? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      const logsDir = path.join(process.cwd(), 'logs');
      if (fs.existsSync(logsDir)) {
        try {
          const logFiles = fs.readdirSync(logsDir);
          logFiles.forEach(file => {
            const filePath = path.join(logsDir, file);
            fs.unlinkSync(filePath);
            logger.info(`Removed log file: ${file}`);
          });
          logger.success('All log files removed');
        } catch (error) {
          logger.error(`Failed to remove log files: ${error.message}`);
        }
      }
    }
    rl.close();
  });
}

/**
 * Main function
 */
async function main() {
  logger.info('Worker Stopper');
  logger.info('================');
  
  try {
    let stoppedWorkers = [];
    
    // Try stopping by PID file first
    const pidFileResults = await stopWorkersByPidFile();
    if (pidFileResults) {
      stoppedWorkers = pidFileResults;
    } else {
      // Fallback to stopping by name
      stoppedWorkers = await stopWorkersByName();
    }
    
    // Display results
    if (stoppedWorkers.length === 0) {
      logger.info('No workers were running');
    } else {
      const successful = stoppedWorkers.filter(w => w.success).length;
      const failed = stoppedWorkers.filter(w => !w.success).length;
      
      console.log('\n📋 Stop Results:');
      console.log(`  ✅ Successfully stopped: ${successful}`);
      console.log(`  ❌ Failed to stop: ${failed}`);
      
      if (successful === stoppedWorkers.length) {
        logger.success('All workers stopped successfully!');
      } else {
        logger.warn('Some workers could not be stopped');
      }
    }
    
    // Cleanup
    cleanup();
    
  } catch (error) {
    logger.error('Failed to stop workers:', error);
    process.exit(1);
  }
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
    logger.error('Failed to run worker stopper:', error);
    process.exit(1);
  });
}

module.exports = { stopWorkersByName, stopWorkersByPidFile };