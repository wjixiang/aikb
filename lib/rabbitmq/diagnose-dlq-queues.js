#!/usr/bin/env node

// Diagnostic script for DLQ (Dead Letter Queue) queues
// This script checks the status of all DLQ queues and identifies why messages might be accumulating

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const logger = {
  info: (msg) => console.log(`[DLQ-Diag] ${msg}`),
  error: (msg) => console.error(`[DLQ-Diag] ${msg}`),
  warn: (msg) => console.warn(`[DLQ-Diag] ${msg}`),
  success: (msg) => console.log(`✅ [DLQ-Diag] ${msg}`),
  fail: (msg) => console.log(`❌ [DLQ-Diag] ${msg}`)
};

// List of DLQ queues to check
const DLQ_QUEUES = [
  'pdf-conversion-dlq',
  'pdf-analysis-dlq',
  'markdown-storage-dlq',
  'markdown-part-storage-dlq',
  'chunking-embedding-dlq'
];

/**
 * Check RabbitMQ connection and get queue info for a specific queue
 */
async function checkRabbitMQQueueInfo(queueName) {
  return new Promise((resolve) => {
    logger.info(`Checking RabbitMQ queue info for ${queueName}...`);
    
    const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
    const managementUrl = `http://${rabbitmqHost}:15672/api/queues/%2F/${queueName}`;
    
    const curlCommand = spawn('curl', ['-s', '-u', 'guest:guest', managementUrl], {
      stdio: 'pipe',
      timeout: 5000
    });
    
    let output = '';
    curlCommand.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    curlCommand.on('close', (code) => {
      if (code === 0 && output) {
        try {
          const queueInfo = JSON.parse(output);
          logger.success(`Successfully retrieved ${queueName} queue info`);
          resolve({ success: true, queueInfo, queueName });
        } catch (e) {
          logger.warn(`Failed to parse ${queueName} queue info`);
          resolve({ success: false, error: 'Parse error', queueName });
        }
      } else {
        logger.fail(`Failed to get ${queueName} queue info (exit code: ${code})`);
        resolve({ success: false, error: 'Connection failed', queueName });
      }
    });
    
    curlCommand.on('error', (error) => {
      logger.error(`Error checking ${queueName} queue info: ${error.message}`);
      resolve({ success: false, error: error.message, queueName });
    });
  });
}

/**
 * Check which workers are consuming from DLQ queues
 */
async function checkDLQConsumers() {
  return new Promise((resolve) => {
    logger.info('Checking DLQ consumers...');
    
    const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
    const consumersUrl = `http://${rabbitmqHost}:15672/api/consumers`;
    
    const curlCommand = spawn('curl', ['-s', '-u', 'guest:guest', consumersUrl], {
      stdio: 'pipe',
      timeout: 5000
    });
    
    let output = '';
    curlCommand.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    curlCommand.on('close', (code) => {
      if (code === 0 && output) {
        try {
          const consumers = JSON.parse(output);
          const dlqConsumers = consumers.filter(c => 
            c.queue.name.includes('-dlq')
          );
          
          logger.success(`Found ${dlqConsumers.length} consumers for DLQ queues`);
          
          if (dlqConsumers.length > 0) {
            dlqConsumers.forEach(consumer => {
              logger.info(`DLQ Consumer: ${consumer.consumer_tag}, Queue: ${consumer.queue.name}, Channel: ${consumer.channel_details.connection_name}`);
            });
          }
          
          resolve({ success: true, consumers: dlqConsumers });
        } catch (e) {
          logger.warn('Failed to parse consumers info');
          resolve({ success: false, error: 'Parse error' });
        }
      } else {
        logger.fail(`Failed to get consumers info (exit code: ${code})`);
        resolve({ success: false, error: 'Connection failed' });
      }
    });
    
    curlCommand.on('error', (error) => {
      logger.error(`Error checking consumers: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Check running processes for workers that might consume from DLQ queues
 */
async function checkDLQWorkerProcesses() {
  return new Promise((resolve) => {
    logger.info('Checking for worker processes that might consume from DLQ queues...');
    
    const psCommand = spawn('ps', ['aux'], {
      stdio: 'pipe'
    });
    
    let output = '';
    psCommand.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    psCommand.on('close', (code) => {
      const lines = output.split('\n');
      const relevantWorkers = [];
      
      // Check for workers that might be expected to consume from DLQ queues
      const workerPatterns = [
        'pdf-processing-coordinator.worker', // Most likely candidate for DLQ handling
        'dlq-handler.worker', // Dedicated DLQ handler if it exists
        'error-handler.worker' // Error handler that might process DLQ
      ];
      
      workerPatterns.forEach(pattern => {
        const found = lines.some(line => 
          line.includes('tsx') && line.includes(pattern) ||
          line.includes('node') && line.includes(pattern)
        );
        
        relevantWorkers.push({
          name: pattern,
          running: found,
          expectedToHandleDLQ: pattern === 'pdf-processing-coordinator.worker' // Most likely candidate
        });
      });
      
      resolve(relevantWorkers);
    });
  });
}

/**
 * Display diagnostic report
 */
function displayDLQDiagnosticReport(queueInfos, consumers, workerProcesses) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DLQ (DEAD LETTER QUEUE) DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  
  // Queue Info for all DLQ queues
  console.log('\n📬 DLQ QUEUE STATUS:');
  let totalDLQMessages = 0;
  let dlqsWithMessages = 0;
  
  queueInfos.forEach(queueResult => {
    if (queueResult.success) {
      const info = queueResult.queueInfo;
      const queueName = queueResult.queueName;
      const messageCount = info.messages || 0;
      
      console.log(`\n  📋 ${queueName}:`);
      console.log(`    Messages: ${messageCount}`);
      console.log(`    Consumers: ${info.consumers || 0}`);
      console.log(`    Memory: ${info.memory || 0} bytes`);
      console.log(`    State: ${info.state || 'unknown'}`);
      
      totalDLQMessages += messageCount;
      
      if (messageCount > 0) {
        dlqsWithMessages++;
        console.log(`    ⚠️  This DLQ has ${messageCount} failed messages!`);
      }
      
      if (info.consumers === 0) {
        console.log(`    ❌ No consumers are connected to this DLQ!`);
      }
    } else {
      console.log(`\n  ❌ ${queueResult.queueName}: Failed to get info - ${queueResult.error}`);
    }
  });
  
  console.log(`\n📊 DLQ SUMMARY:`);
  console.log(`  Total failed messages across all DLQs: ${totalDLQMessages}`);
  console.log(`  DLQs with messages: ${dlqsWithMessages}/${queueInfos.length}`);
  
  // Consumers
  console.log('\n👥 DLQ CONSUMERS:');
  if (consumers.success) {
    if (consumers.consumers.length > 0) {
      consumers.consumers.forEach(consumer => {
        console.log(`  ✅ ${consumer.consumer_tag} on ${consumer.queue.name} (${consumer.channel_details.connection_name})`);
      });
    } else {
      console.log(`  ❌ No consumers found for any DLQ queues`);
    }
  } else {
    console.log(`  ❌ Failed to get consumers info: ${consumers.error}`);
  }
  
  // Worker Processes
  console.log('\n🏃 POTENTIAL DLQ HANDLER PROCESSES:');
  workerProcesses.forEach(worker => {
    const statusIcon = worker.running ? '✅' : '❌';
    const dlqIcon = worker.expectedToHandleDLQ ? '🎯' : '📋';
    console.log(`  ${statusIcon} ${dlqIcon} ${worker.name}`);
    if (worker.expectedToHandleDLQ && !worker.running) {
      console.log(`    ⚠️  This worker should handle DLQ messages but is not running!`);
    }
  });
  
  // Diagnosis
  console.log('\n🔬 DLQ DIAGNOSIS:');
  if (totalDLQMessages > 0) {
    console.log(`  🚨 DLQ ISSUES IDENTIFIED:`);
    console.log(`     Found ${totalDLQMessages} failed messages across ${dlqsWithMessages} DLQ queues.`);
    console.log(`     `);
    
    if (consumers.consumers.length === 0) {
      console.log(`     ROOT CAUSE: No consumers are processing DLQ messages!`);
      console.log(`     `);
      console.log(`     EXPECTED BEHAVIOR:`);
      console.log(`     Failed messages should be inspected and either:`);
      console.log(`     1. Requeued for retry (if the error was temporary)`);
      console.log(`     2. Moved to error storage for manual review`);
      console.log(`     3. Discarded if appropriate`);
      console.log(`     `);
      console.log(`     SOLUTION:`);
      console.log(`     1. Add DLQ consumer to pdf-processing-coordinator.worker`);
      console.log(`     2. Create a dedicated DLQ handler worker`);
      console.log(`     3. Implement retry logic with exponential backoff`);
    } else {
      console.log(`     Consumers exist but messages are still accumulating.`);
      console.log(`     The issue might be with DLQ message processing logic.`);
    }
  } else {
    console.log(`  ✅ No failed messages found in DLQ queues`);
    console.log(`  📝 System is processing messages successfully`);
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main function
 */
async function main() {
  logger.info('DLQ (DEAD LETTER QUEUE) DIAGNOSTIC');
  logger.info('=====================================');
  
  try {
    // Check all DLQ queue info
    const queuePromises = DLQ_QUEUES.map(queue => checkRabbitMQQueueInfo(queue));
    const queueInfos = await Promise.all(queuePromises);
    
    // Check consumers
    const consumers = await checkDLQConsumers();
    
    // Check worker processes
    const workerProcesses = await checkDLQWorkerProcesses();
    
    // Display report
    displayDLQDiagnosticReport(queueInfos, consumers, workerProcesses);
    
  } catch (error) {
    logger.error('DLQ diagnostic failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to run DLQ diagnostic:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseDLQ: main };