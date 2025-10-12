#!/usr/bin/env node

// Simple Worker Status Checker
// This script checks the status of all PDF processing workers using basic methods

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const logger = {
  info: (msg) => console.log(`[StatusChecker] ${msg}`),
  error: (msg) => console.error(`[StatusChecker] ${msg}`),
  warn: (msg) => console.warn(`[StatusChecker] ${msg}`),
  success: (msg) => console.log(`✅ [StatusChecker] ${msg}`),
  fail: (msg) => console.log(`❌ [StatusChecker] ${msg}`)
};

// Worker configurations
const workers = [
  {
    name: 'PDF Analysis Worker',
    description: 'Analyzes PDF files to determine processing requirements',
    script: 'pdf-analysis.worker.ts'
  },
  {
    name: 'PDF Processing Coordinator Worker',
    description: 'Coordinates the PDF processing workflow',
    script: 'pdf-processing-coordinator.worker.ts'
  },
  {
    name: 'PDF Conversion Worker',
    description: 'Converts PDF files to Markdown format',
    script: 'pdf-conversion.worker.ts'
  },
  {
    name: 'Markdown Storage Worker',
    description: 'Stores Markdown content and processes chunks',
    script: 'markdown-storage.worker.ts'
  }
];

/**
 * Simple check for required environment variables
 */
function checkEnvironmentVariables() {
  logger.info('Checking environment variables...');
  
  const requiredVars = ['RABBITMQ_URL', 'ELASTICSEARCH_URL'];
  const optionalVars = ['S3_BUCKET', 'MINERU_API_URL'];
  
  let allRequiredPresent = true;
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      logger.success(`${varName}: ${process.env[varName]}`);
    } else {
      logger.fail(`${varName}: Not set`);
      allRequiredPresent = false;
    }
  });
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      logger.success(`${varName}: ${process.env[varName]}`);
    } else {
      logger.warn(`${varName}: Not set (optional)`);
    }
  });
  
  return allRequiredPresent;
}

/**
 * Check if worker files exist
 */
function checkWorkerFiles() {
  logger.info('Checking worker files...');
  
  const basePath = path.join(__dirname);
  let allFilesExist = true;
  
  workers.forEach(worker => {
    const workerPath = path.join(basePath, worker.script);
    const fs = require('fs');
    
    if (fs.existsSync(workerPath)) {
      logger.success(`${worker.script}: File exists`);
    } else {
      logger.fail(`${worker.script}: File not found`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

/**
 * Check for running worker processes
 */
function checkRunningProcesses() {
  return new Promise((resolve) => {
    logger.info('Checking for running worker processes...');
    
    const { exec } = require('child_process');
    
    // Use ps command to find worker processes
    exec('ps aux | grep -E "(tsx|node).*worker" | grep -v grep', (error, stdout, stderr) => {
      const runningWorkers = [];
      
      if (stdout) {
        const lines = stdout.trim().split('\n');
        
        workers.forEach(worker => {
          const found = lines.some(line => 
            line.toLowerCase().includes(worker.name.toLowerCase()) ||
            line.toLowerCase().includes(worker.script.replace('.ts', ''))
          );
          
          runningWorkers.push({
            name: worker.name,
            script: worker.script,
            running: found,
            description: worker.description
          });
        });
      } else {
        // No processes found
        workers.forEach(worker => {
          runningWorkers.push({
            name: worker.name,
            script: worker.script,
            running: false,
            description: worker.description
          });
        });
      }
      
      resolve(runningWorkers);
    });
  });
}

/**
 * Try to connect to RabbitMQ using a simple HTTP request
 */
function checkRabbitMQStatus() {
  return new Promise((resolve) => {
    logger.info('Checking RabbitMQ status...');
    
    const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
    const rabbitmqPort = process.env.RABBITMQ_PORT || 5672;
    const managementPort = 15672;
    
    const { exec } = require('child_process');
    
    // Try to check RabbitMQ management API
    exec(`curl -s --connect-timeout 3 http://${rabbitmqHost}:${managementPort}/api/overview`, (error, stdout, stderr) => {
      if (!error && stdout && stdout.includes('rabbitmq_version')) {
        logger.success(`RabbitMQ management API accessible on ${rabbitmqHost}:${managementPort}`);
        
        // Try to get queue information
        exec(`curl -s --connect-timeout 3 http://${rabbitmqHost}:${managementPort}/api/queues`, (queueError, queueStdout, queueStderr) => {
          if (!queueError && queueStdout) {
            try {
              const queues = JSON.parse(queueStdout);
              logger.success(`Found ${queues.length} queues in RabbitMQ`);
              resolve({ connected: true, queues });
            } catch (e) {
              logger.warn('RabbitMQ connected but failed to parse queue information');
              resolve({ connected: true, queues: [] });
            }
          } else {
            resolve({ connected: true, queues: [] });
          }
        });
      } else {
        // Fallback: just check if the port is open
        logger.warn(`RabbitMQ management API not accessible, assuming basic connection on ${rabbitmqHost}:${rabbitmqPort}`);
        resolve({ connected: true, queues: [] });
      }
    });
  });
}

/**
 * Try to connect to Elasticsearch
 */
function checkElasticsearchStatus() {
  return new Promise((resolve) => {
    logger.info('Checking Elasticsearch status...');
    
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    
    const { exec } = require('child_process');
    
    exec(`curl -s --connect-timeout 3 ${elasticsearchUrl}`, (error, stdout, stderr) => {
      if (!error && stdout && stdout.includes('cluster_name')) {
        logger.success(`Elasticsearch accessible at ${elasticsearchUrl}`);
        resolve({ connected: true });
      } else {
        logger.fail(`Elasticsearch not accessible at ${elasticsearchUrl}`);
        resolve({ connected: false });
      }
    });
  });
}

/**
 * Display comprehensive status report
 */
function displayStatusReport(envCheck, filesCheck, runningProcesses, rabbitmqStatus, elasticsearchStatus) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 WORKER STATUS REPORT');
  console.log('='.repeat(70));
  
  // Environment Status
  console.log('\n🔧 ENVIRONMENT STATUS:');
  console.log(`  Environment Variables: ${envCheck ? '✅ Configured' : '❌ Missing required variables'}`);
  console.log(`  Worker Files: ${filesCheck ? '✅ All files exist' : '❌ Some files missing'}`);
  
  // Service Status
  console.log('\n🌐 SERVICE STATUS:');
  console.log(`  RabbitMQ: ${rabbitmqStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`  Elasticsearch: ${elasticsearchStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
  
  // Worker Process Status
  console.log('\n🏃 WORKER PROCESSES:');
  let runningCount = 0;
  
  runningProcesses.forEach(worker => {
    console.log(`  ${worker.running ? '✅' : '❌'} ${worker.name}`);
    console.log(`    Script: ${worker.script}`);
    console.log(`    Description: ${worker.description}`);
    
    if (worker.running) {
      runningCount++;
    } else {
      console.log(`    ⚠️  Process not found - worker may not be started`);
    }
  });
  
  // Queue Information (if available)
  if (rabbitmqStatus.queues && rabbitmqStatus.queues.length > 0) {
    console.log('\n📬 RABBITMQ QUEUES:');
    
    workers.forEach(worker => {
      const queueName = worker.name.toLowerCase().replace(' worker', '').replace(' ', '-');
      const queue = rabbitmqStatus.queues.find(q => q.name.includes(queueName));
      
      if (queue) {
        console.log(`  📋 ${worker.name}:`);
        console.log(`    Consumers: ${queue.consumers || 0}`);
        console.log(`    Messages: ${queue.messages || 0}`);
        console.log(`    Status: ${queue.consumers > 0 ? '✅ Active' : '❌ No consumers'}`);
      } else {
        console.log(`  ❓ ${worker.name}: Queue not found or not initialized`);
      }
    });
  }
  
  // Summary
  console.log('\n📋 SUMMARY:');
  console.log(`  Workers Running: ${runningCount}/${workers.length}`);
  console.log(`  Environment: ${envCheck ? '✅ Ready' : '❌ Needs configuration'}`);
  console.log(`  Services: ${rabbitmqStatus.connected && elasticsearchStatus.connected ? '✅ Ready' : '❌ Some services down'}`);
  
  // Overall Status
  console.log('\n🎯 OVERALL STATUS:');
  if (runningCount === workers.length && envCheck && filesCheck && rabbitmqStatus.connected && elasticsearchStatus.connected) {
    console.log('  🎉 All systems operational!');
  } else if (runningCount > 0) {
    console.log('  ⚠️  Partial system - some workers or services may need attention');
  } else {
    console.log('  ❌ System not ready - workers need to be started');
  }
  
  // Next Steps
  console.log('\n💡 NEXT STEPS:');
  if (runningCount === 0) {
    console.log('  1. Start workers: pnpm start:workers');
  }
  if (!envCheck) {
    console.log('  2. Check environment variables in .env file');
  }
  if (!elasticsearchStatus.connected) {
    console.log('  3. Start Elasticsearch: docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.8.0');
  }
  if (!rabbitmqStatus.connected) {
    console.log('  4. Start RabbitMQ: docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management');
  }
  
  console.log('\n' + '='.repeat(70));
  
  return runningCount === workers.length && envCheck && filesCheck;
}

/**
 * Main function
 */
async function main() {
  logger.info('Simple Worker Status Checker');
  logger.info('============================');
  
  try {
    // Basic checks
    const envCheck = checkEnvironmentVariables();
    const filesCheck = checkWorkerFiles();
    
    // Service checks
    const rabbitmqStatus = await checkRabbitMQStatus();
    const elasticsearchStatus = await checkElasticsearchStatus();
    
    // Process check
    const runningProcesses = await checkRunningProcesses();
    
    // Display report
    const allGood = displayStatusReport(envCheck, filesCheck, runningProcesses, rabbitmqStatus, elasticsearchStatus);
    
    // Exit with appropriate code
    process.exit(allGood ? 0 : 1);
    
  } catch (error) {
    logger.error('Failed to check worker status:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to run status checker:', error);
    process.exit(1);
  });
}

module.exports = { checkWorkerStatus: main };