import * as amqp from 'amqplib';
import { getValidatedRabbitMQConfig } from './knowledgeBase/lib/rabbitmq/rabbitmq.config';
import createLoggerWithPrefix from './knowledgeBase/lib/logger';

const logger = createLoggerWithPrefix('RabbitMQConnectionTest');

// Test configurations based on different possible setups
const testConfigs = [
  {
    name: 'Default config from rabbitmq.config.ts',
    config: getValidatedRabbitMQConfig(),
  },
  {
    name: 'Config with docker-compose.yml credentials',
    config: {
      hostname: 'rabbitmq',
      port: 5672,
      username: 'admin',
      password: 'admin123',
      vhost: '/',
    },
  },
  {
    name: 'Config with docker-compose.yml vhost',
    config: {
      hostname: 'rabbitmq',
      port: 5672,
      username: 'admin',
      password: 'admin123',
      vhost: 'my_vhost',
    },
  },
  {
    name: 'Config with localhost (for local testing)',
    config: {
      hostname: 'localhost',
      port: 5672,
      username: 'admin',
      password: 'admin123',
      vhost: 'my_vhost',
    },
  },
  {
    name: 'Config with localhost and default vhost',
    config: {
      hostname: 'localhost',
      port: 5672,
      username: 'admin',
      password: 'admin123',
      vhost: '/',
    },
  },
];

async function testConnection(configName: string, config: any): Promise<boolean> {
  logger.info(`Testing connection: ${configName}`);
  logger.info(`Config:`, config);
  
  try {
    const connection = await amqp.connect(config);
    logger.info(`✅ Connection successful for: ${configName}`);
    
    // Test creating a channel
    const channel = await connection.createChannel();
    logger.info(`✅ Channel created successfully for: ${configName}`);
    
    // Test basic operations
    await channel.assertQueue('test-queue', { durable: false });
    logger.info(`✅ Queue assertion successful for: ${configName}`);
    
    // Clean up
    await channel.close();
    await connection.close();
    logger.info(`✅ Connection closed successfully for: ${configName}`);
    
    return true;
  } catch (error) {
    logger.error(`❌ Connection failed for: ${configName}`, error);
    return false;
  }
}

async function checkRabbitMQManagementUI(): Promise<void> {
  const managementUrls = [
    'http://localhost:8080',
    'http://localhost:15672',
    'http://rabbitmq:15672',
  ];
  
  logger.info('Checking RabbitMQ Management UI availability...');
  
  for (const url of managementUrls) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch(url);
      if (response.ok) {
        logger.info(`✅ Management UI available at: ${url}`);
      } else {
        logger.warn(`⚠️ Management UI responded with status ${response.status} at: ${url}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Management UI not available at: ${url}`, error.message);
    }
  }
}

async function main() {
  logger.info('🔍 Starting RabbitMQ connection diagnostics...');
  
  // Check if RabbitMQ container is running
  logger.info('Checking if RabbitMQ container is running...');
  try {
    const { execSync } = require('child_process');
    const dockerPs = execSync('docker ps --filter "name=rabbitmq" --format "table {{.Names}}\t{{.Status}}"', { encoding: 'utf8' });
    logger.info('Docker containers with "rabbitmq" in name:');
    logger.info(dockerPs);
  } catch (error) {
    logger.error('Failed to check Docker containers:', error.message);
  }
  
  // Test different configurations
  let successfulConnection = false;
  for (const testConfig of testConfigs) {
    if (testConfig.config) {
      const success = await testConnection(testConfig.name, testConfig.config);
      if (success) {
        successfulConnection = true;
      }
    } else {
      logger.warn(`⚠️ Skipping ${testConfig.name} - config is null or undefined`);
    }
    logger.info('---');
  }
  
  // Check Management UI
  await checkRabbitMQManagementUI();
  
  // Summary
  if (successfulConnection) {
    logger.info('🎉 At least one configuration successfully connected to RabbitMQ!');
  } else {
    logger.error('❌ No configuration could connect to RabbitMQ. Please check:');
    logger.error('1. RabbitMQ container is running: docker ps | grep rabbitmq');
    logger.error('2. Port mapping is correct: docker-compose.yml');
    logger.error('3. Credentials match between docker-compose.yml and application config');
    logger.error('4. Virtual host configuration is consistent');
  }
}

// Run the test
main().catch(error => {
  logger.error('Test script failed:', error);
  process.exit(1);
});