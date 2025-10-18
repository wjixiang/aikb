#!/usr/bin/env node

// Diagnostic script for pdf-conversion-completed queue
// This script checks the status of the pdf-conversion-completed queue and identifies why messages might be accumulating

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const logger = {
  info: (msg) => console.log(`[Diag] ${msg}`),
  error: (msg) => console.error(`[Diag] ${msg}`),
  warn: (msg) => console.warn(`[Diag] ${msg}`),
  success: (msg) => console.log(`✅ [Diag] ${msg}`),
  fail: (msg) => console.log(`❌ [Diag] ${msg}`)
};

/**
 * Check RabbitMQ connection and get queue info
 */
async function checkRabbitMQQueueInfo() {
  return new Promise((resolve) => {
    logger.info('Checking RabbitMQ queue info for pdf-conversion-completed...');
    
    const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
    const managementUrl = `http://${rabbitmqHost}:15672/api/queues/%2F/pdf-conversion-completed`;
    
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
          logger.success('Successfully retrieved queue info');
          resolve({ success: true, queueInfo });
        } catch (e) {
          logger.warn('Failed to parse queue info');
          resolve({ success: false, error: 'Parse error' });
        }
      } else {
        logger.fail(`Failed to get queue info (exit code: ${code})`);
        resolve({ success: false, error: 'Connection failed' });
      }
    });
    
    curlCommand.on('error', (error) => {
      logger.error(`Error checking queue info: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Check which workers are consuming from which queues
 */
async function checkWorkerConsumers() {
  return new Promise((resolve) => {
    logger.info('Checking worker consumers...');
    
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
          const pdfConversionCompletedConsumers = consumers.filter(c => 
            c.queue.name === 'pdf-conversion-completed'
          );
          
          logger.success(`Found ${pdfConversionCompletedConsumers.length} consumers for pdf-conversion-completed queue`);
          
          if (pdfConversionCompletedConsumers.length > 0) {
            pdfConversionCompletedConsumers.forEach(consumer => {
              logger.info(`Consumer: ${consumer.consumer_tag}, Channel: ${consumer.channel_details.connection_name}`);
            });
          }
          
          resolve({ success: true, consumers: pdfConversionCompletedConsumers });
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
 * Check running processes for workers that should consume from pdf-conversion-completed
 */
async function checkRelevantWorkerProcesses() {
  return new Promise((resolve) => {
    logger.info('Checking for worker processes that should consume from pdf-conversion-completed...');
    
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
      
      // Check for workers that might be expected to consume from pdf-conversion-completed
      const workerPatterns = [
        'markdown-storage.worker', // Most likely candidate
        'pdf-processing-coordinator.worker', // Another possibility
        'chunking-embedding.worker' // Might consume this queue
      ];
      
      workerPatterns.forEach(pattern => {
        const found = lines.some(line => 
          line.includes('tsx') && line.includes(pattern) ||
          line.includes('node') && line.includes(pattern)
        );
        
        relevantWorkers.push({
          name: pattern,
          running: found,
          expectedToConsume: pattern === 'markdown-storage.worker' // Most likely candidate
        });
      });
      
      resolve(relevantWorkers);
    });
  });
}

/**
 * Display diagnostic report
 */
function displayDiagnosticReport(queueInfo, consumers, workerProcesses) {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 PDF-CONVERSION-COMPLETED QUEUE DIAGNOSTIC REPORT');
  console.log('='.repeat(70));
  
  // Queue Info
  console.log('\n📬 QUEUE STATUS:');
  if (queueInfo.success) {
    const info = queueInfo.queueInfo;
    console.log(`  Messages: ${info.messages || 0}`);
    console.log(`  Consumers: ${info.consumers || 0}`);
    console.log(`  Memory: ${info.memory || 0} bytes`);
    console.log(`  State: ${info.state || 'unknown'}`);
    
    if (info.messages > 0) {
      console.log(`  ⚠️  Queue has ${info.messages} messages waiting to be processed`);
    }
    
    if (info.consumers === 0) {
      console.log(`  ❌ CRITICAL: No consumers are connected to this queue!`);
    }
  } else {
    console.log(`  ❌ Failed to get queue info: ${queueInfo.error}`);
  }
  
  // Consumers
  console.log('\n👥 CONSUMERS:');
  if (consumers.success) {
    if (consumers.consumers.length > 0) {
      consumers.consumers.forEach(consumer => {
        console.log(`  ✅ ${consumer.consumer_tag} (${consumer.channel_details.connection_name})`);
      });
    } else {
      console.log(`  ❌ No consumers found for pdf-conversion-completed queue`);
    }
  } else {
    console.log(`  ❌ Failed to get consumers info: ${consumers.error}`);
  }
  
  // Worker Processes
  console.log('\n🏃 RELEVANT WORKER PROCESSES:');
  workerProcesses.forEach(worker => {
    const statusIcon = worker.running ? '✅' : '❌';
    const consumeIcon = worker.expectedToConsume ? '🎯' : '📋';
    console.log(`  ${statusIcon} ${consumeIcon} ${worker.name}`);
    if (worker.expectedToConsume && !worker.running) {
      console.log(`    ⚠️  This worker should be consuming from pdf-conversion-completed but is not running!`);
    }
  });
  
  // Diagnosis
  console.log('\n🔬 DIAGNOSIS:');
  if (queueInfo.success && queueInfo.queueInfo.messages > 0 && consumers.consumers.length === 0) {
    console.log(`  🚨 ROOT CAUSE IDENTIFIED:`);
    console.log(`     The pdf-conversion-completed queue has ${queueInfo.queueInfo.messages} messages`);
    console.log(`     but NO consumers are connected to process them.`);
    console.log(`     `);
    console.log(`     EXPECTED BEHAVIOR:`);
    console.log(`     The markdown-storage.worker should be consuming from this queue`);
    console.log(`     to process completed PDF conversions and store the markdown content.`);
    console.log(`     `);
    console.log(`     SOLUTION:`);
    console.log(`     1. Check if markdown-storage.worker is running (it should be)`);
    console.log(`     2. Verify it's configured to consume from pdf-conversion-completed`);
    console.log(`     3. Check the worker's logs for any connection or subscription errors`);
  } else if (consumers.consumers.length > 0) {
    console.log(`  ✅ Consumers are connected to the queue`);
    console.log(`  📝 The issue might be with message processing speed or errors`);
  } else {
    console.log(`  ❓ Unable to determine the exact cause`);
    console.log(`  📋 Check RabbitMQ management interface for more details`);
  }
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Main function
 */
async function main() {
  logger.info('PDF-CONVERSION-COMPLETED QUEUE DIAGNOSTIC');
  logger.info('==========================================');
  
  try {
    // Check queue info
    const queueInfo = await checkRabbitMQQueueInfo();
    
    // Check consumers
    const consumers = await checkWorkerConsumers();
    
    // Check worker processes
    const workerProcesses = await checkRelevantWorkerProcesses();
    
    // Display report
    displayDiagnosticReport(queueInfo, consumers, workerProcesses);
    
  } catch (error) {
    logger.error('Diagnostic failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to run diagnostic:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseQueue: main };