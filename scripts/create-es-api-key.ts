import axios from 'axios';
import { Client } from '@elastic/elasticsearch';

/**
 * Interface for API key creation request
 */
interface CreateApiKeyRequest {
  name?: string;
  expiration?: string;
  role_descriptors?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Interface for API key response
 */
interface ApiKeyResponse {
  id: string;
  name: string;
  api_key: string;
  encoded: string;
  expiration?: number;
  invalidated?: boolean;
  created_by?: string;
  created?: number;
  username?: string;
  realm?: string;
}

/**
 * Configuration options for the script
 */
interface ScriptConfig {
  elasticsearchUrl: string;
  username?: string;
  password?: string;
  apiKeyName?: string;
  expiration?: string;
  outputFormat?: 'json' | 'env' | 'table';
}

/**
 * Create an Elasticsearch API key
 * This script can work with both basic auth and existing API key authentication
 */
async function createApiKey(config: ScriptConfig): Promise<ApiKeyResponse> {
  const { elasticsearchUrl, username, password, apiKeyName, expiration } =
    config;

  // Create Elasticsearch client with appropriate authentication
  const clientConfig: any = {
    node: elasticsearchUrl,
  };

  // Use basic auth if provided, otherwise try to use existing API key from env
  if (username && password) {
    clientConfig.auth = {
      username,
      password,
    };
  } else if (process.env.ELASTICSEARCH_API_KEY) {
    clientConfig.auth = {
      apiKey: process.env.ELASTICSEARCH_API_KEY,
    };
  }

  const client = new Client(clientConfig);

  try {
    // Validate expiration format if provided (do this early)
    if (expiration && !isValidExpirationFormat(expiration)) {
      throw new Error(
        `Invalid expiration format: ${expiration}. Use formats like '1d', '7d', '30d', '1h', '1M', or ISO date string.`,
      );
    }

    // First, check if Elasticsearch is accessible
    const info = await client.info();
    console.log(`Connected to Elasticsearch ${info.version.number}`);

    // Check if security is enabled by trying to access security API
    let securityEnabled = false;
    try {
      // Try to access the security API to check if it's available
      await client.security.getUser({ username: 'test' });
      securityEnabled = true;
    } catch (securityError: any) {
      if (
        securityError.meta?.statusCode === 401 ||
        securityError.meta?.statusCode === 403
      ) {
        // 401/403 means security is enabled but we need proper auth
        securityEnabled = true;
      } else if (
        securityError.meta?.statusCode === 404 ||
        (securityError.message &&
          securityError.message.includes('no handler found'))
      ) {
        // 404 or "no handler found" means security is not enabled
        securityEnabled = false;
      }
    }

    if (!securityEnabled) {
      throw new Error(
        'Elasticsearch security is not enabled. API keys require security features to be enabled.',
      );
    }

    // Prepare API key creation request
    const createRequest: CreateApiKeyRequest = {};

    if (apiKeyName) {
      createRequest.name = apiKeyName;
    }

    if (expiration) {
      createRequest.expiration = expiration;
    }

    // Create the API key
    const response = await client.security.createApiKey({
      body: createRequest as any,
    });

    // Extract the actual API key data from the response
    // The actual response structure from Elasticsearch client
    const apiKeyData: ApiKeyResponse = {
      id: response.id,
      name: response.name,
      api_key: response.api_key,
      encoded: response.encoded,
      expiration: response.expiration,
      // These fields might not be in the immediate response, so we'll set defaults
      invalidated: false,
      created_by: 'script',
      created: Date.now(),
      username: undefined,
      realm: undefined,
    };

    return apiKeyData;
  } catch (error: any) {
    if (error.meta?.statusCode === 401) {
      throw new Error(
        'Authentication failed. Please provide valid credentials or ensure security is enabled.',
      );
    }
    if (error.meta?.statusCode === 403) {
      throw new Error(
        'Insufficient permissions. User needs manage_api_key privilege.',
      );
    }
    if (error.message && error.message.includes('no handler found')) {
      throw new Error(
        'Elasticsearch security is not enabled. API keys require security features to be enabled.',
      );
    }
    throw error;
  }
}

/**
 * Format the API key response based on output format
 */
function formatOutput(response: ApiKeyResponse, format: string): string {
  switch (format) {
    case 'env':
      return `# Elasticsearch API Key Configuration
ELASTICSEARCH_API_KEY=${response.encoded}
API_KEY_ID=${response.id}
API_KEY_NAME=${response.name}
API_KEY_EXPIRATION=${response.expiration || 'never'}
`;

    case 'json':
      return JSON.stringify(response, null, 2);

    case 'table':
    default:
      const createdDate = response.created
        ? new Date(response.created).toISOString()
        : 'Unknown';
      const createdBy = response.created_by || 'Unknown';
      return `
┌─────────────────────────────────────────────────────────────────┐
│                    Elasticsearch API Key                       │
├─────────────────────────────────────────────────────────────────┤
│ ID:        ${response.id.padEnd(54)} │
│ Name:      ${response.name.padEnd(54)} │
│ Created:   ${createdDate.padEnd(54)} │
│ Created By:${createdBy.padEnd(54)} │
│ Expires:   ${response.expiration ? new Date(response.expiration).toISOString() : 'Never'.padEnd(54)} │
│ Encoded:   ${response.encoded.padEnd(54)} │
└─────────────────────────────────────────────────────────────────┘
`;
  }
}

/**
 * Main function to run the script
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments or use defaults
    const config: ScriptConfig = {
      elasticsearchUrl:
        process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
      apiKeyName: process.argv[2] || 'api-key-' + Date.now(),
      expiration: process.argv[3], // Optional expiration like "1d", "7d", "30d"
      outputFormat: (process.argv[4] as any) || 'table',
    };

    console.log(
      `Creating API key for Elasticsearch at: ${config.elasticsearchUrl}`,
    );
    console.log(`API Key Name: ${config.apiKeyName}`);

    if (config.expiration) {
      console.log(`Expiration: ${config.expiration}`);
    }

    // Create the API key
    const apiKeyResponse = await createApiKey(config);

    // Format and display the result
    const output = formatOutput(apiKeyResponse, config.outputFormat || 'table');
    console.log(output);

    // Save to .env file if requested
    if (config.outputFormat === 'env') {
      const fs = require('fs');
      const envPath = '.env';

      // Read existing .env file
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update or add the API key
      const apiKeyLine = `ELASTICSEARCH_API_KEY=${apiKeyResponse.encoded}`;
      const lines = envContent.split('\n');
      const apiKeyIndex = lines.findIndex((line) =>
        line.startsWith('ELASTICSEARCH_API_KEY='),
      );

      if (apiKeyIndex >= 0) {
        lines[apiKeyIndex] = apiKeyLine;
      } else {
        lines.push(apiKeyLine);
      }

      fs.writeFileSync(envPath, lines.join('\n'));
      console.log(`API key saved to ${envPath}`);
    }
  } catch (error: any) {
    console.error('Error creating API key:', error.message);

    if (error.message.includes('security is not enabled')) {
      console.log('\n💡 To enable security in Elasticsearch:');
      console.log(
        '1. Update docker-compose.yml to set xpack.security.enabled=true',
      );
      console.log('2. Add environment variables for elastic user password');
      console.log(
        '3. Restart the containers: docker-compose down && docker-compose up -d',
      );
      console.log('4. Run this script again with credentials:');
      console.log(
        '   ELASTICSEARCH_USERNAME=elastic ELASTICSEARCH_PASSWORD=yourpassword npx tsx scripts/create-es-api-key.ts',
      );
    }

    if (error.message.includes('Authentication failed')) {
      console.log('\n💡 Authentication tips:');
      console.log('1. Ensure Elasticsearch security is enabled');
      console.log('2. Provide valid credentials via environment variables:');
      console.log('   export ELASTICSEARCH_USERNAME=elastic');
      console.log('   export ELASTICSEARCH_PASSWORD=yourpassword');
      console.log('3. Or use an existing API key via ELASTICSEARCH_API_KEY');
    }

    process.exit(1);
  }
}

/**
 * Helper function to test API key
 */
async function testApiKey(
  encodedApiKey: string,
  elasticsearchUrl: string,
): Promise<boolean> {
  try {
    const client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: encodedApiKey,
      },
    });

    await client.info();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate expiration format
 */
function isValidExpirationFormat(expiration: string): boolean {
  // Check for time unit patterns (e.g., "1d", "7d", "30d", "1h", "1M")
  const timeUnitPattern = /^\d+[smhdwMy]$/;
  if (timeUnitPattern.test(expiration)) {
    return true;
  }

  // Check for ISO date string
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (isoDatePattern.test(expiration)) {
    return true;
  }

  return false;
}

// Export functions for testing
export { createApiKey, formatOutput, testApiKey };

// Run the script if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
