#!/usr/bin/env node

// Fix for Node.js compatibility with undici
global.File = class File {
  constructor(chunks, name, options = {}) {
    this.chunks = chunks;
    this.name = name;
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
};

const { Client } = require('@elastic/elasticsearch');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_URL_API_KEY || '';

async function checkElasticsearch() {
  console.log('Checking Elasticsearch availability...');
  
  try {
    const client = new Client({
      node: ELASTICSEARCH_URL,
      auth: {
        apiKey: ELASTICSEARCH_API_KEY,
      },
    });

    // Try to ping Elasticsearch
    await client.ping();
    console.log('✅ Elasticsearch is available at', ELASTICSEARCH_URL);
    return true;
  } catch (error) {
    console.log('❌ Elasticsearch is not available at', ELASTICSEARCH_URL);
    console.log('Error:', error.message);
    return false;
  }
}

async function startElasticsearch() {
  console.log('\nAttempting to start Elasticsearch...');
  
  const elasticStartDir = path.join(__dirname, '../../elastic-start-local');
  
  if (!fs.existsSync(elasticStartDir)) {
    console.error('❌ elastic-start-local directory not found');
    return false;
  }

  try {
    // Check if .env file exists in elastic-start-local
    const envFile = path.join(elasticStartDir, '.env');
    if (!fs.existsSync(envFile)) {
      console.log('Creating .env file for Elasticsearch...');
      const defaultEnv = `ES_LOCAL_VERSION=8.15.1
ES_LOCAL_CONTAINER_NAME=dev-elasticsearch
ES_LOCAL_PORT=9200
ES_LOCAL_PASSWORD=changeme
ES_LOCAL_HEAP_INIT=1g
ES_LOCAL_HEAP_MAX=1g
ES_LOCAL_DISK_SPACE_REQUIRED=2gb
KIBANA_LOCAL_CONTAINER_NAME=dev-kibana
KIBANA_LOCAL_PORT=5601
KIBANA_LOCAL_PASSWORD=changeme
KIBANA_ENCRYPTION_KEY=32_characters_long_string_here
ES_LOCAL_URL=http://elasticsearch:9200
ES_LOCAL_API_KEY=
ES_LOCAL_LICENSE=basic`;
      
      fs.writeFileSync(envFile, defaultEnv);
    }

    // Start Elasticsearch using docker-compose
    console.log('Starting Elasticsearch with docker-compose...');
    execSync('docker compose up -d elasticsearch', {
      cwd: elasticStartDir,
      stdio: 'inherit'
    });

    // Wait for Elasticsearch to be ready
    console.log('Waiting for Elasticsearch to be ready...');
    let retries = 30;
    let isReady = false;

    while (retries > 0 && !isReady) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      isReady = await checkElasticsearch();
      retries--;
    }

    if (isReady) {
      console.log('✅ Elasticsearch is now ready!');
      return true;
    } else {
      console.log('❌ Failed to start Elasticsearch within timeout');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to start Elasticsearch:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== Elasticsearch Check and Start Script ===\n');
  
  const isAvailable = await checkElasticsearch();
  
  if (!isAvailable) {
    const started = await startElasticsearch();
    
    if (!started) {
      console.log('\n❌ Could not start Elasticsearch automatically.');
      console.log('Please start it manually using:');
      console.log('  cd elastic-start-local && ./start.sh');
      console.log('Or check if Docker is running and you have sufficient permissions.');
      process.exit(1);
    }
  }
  
  console.log('\n✅ Elasticsearch is ready for use!');
  console.log('\nYou can now run tests or examples that use Elasticsearch.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { checkElasticsearch, startElasticsearch };