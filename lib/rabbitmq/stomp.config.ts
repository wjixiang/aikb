import { MessageServiceConfig } from './message-service.interface';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('StompConfig');

/**
 * Default STOMP configuration
 */
export const defaultStompConfig: MessageServiceConfig = {
  protocol: 'stomp' as any,
  connectionOptions: {
    // Default STOMP connection options for RabbitMQ
    brokerURL: process.env.STOMP_BROKER_URL || 'ws://localhost:15674/ws',
    connectHeaders: {
      login: process.env.STOMP_LOGIN || 'guest',
      passcode: process.env.STOMP_PASSCODE || 'guest',
      host: process.env.STOMP_VHOST || '/',
    },
    debug: undefined, // Disable debug to avoid function context issues
    reconnectDelay: parseInt(process.env.STOMP_RECONNECT_DELAY || '5000'),
    heartbeatIncoming: parseInt(process.env.STOMP_HEARTBEAT_INCOMING || '4000'),
    heartbeatOutgoing: parseInt(process.env.STOMP_HEARTBEAT_OUTGOING || '4000'),
  },
  reconnect: {
    maxAttempts: parseInt(process.env.STOMP_MAX_RECONNECT_ATTEMPTS || '5'),
    delay: parseInt(process.env.STOMP_RECONNECT_DELAY || '5000'),
  },
  healthCheck: {
    interval: parseInt(process.env.STOMP_HEALTH_CHECK_INTERVAL || '30000'),
    timeout: parseInt(process.env.STOMP_HEALTH_CHECK_TIMEOUT || '5000'),
  },
};

/**
 * STOMP configuration for different environments
 */
export const stompConfigs = {
  development: {
    ...defaultStompConfig,
    connectionOptions: {
      ...defaultStompConfig.connectionOptions,
      brokerURL: process.env.STOMP_BROKER_URL_DEV || 'ws://localhost:15674/ws',
    },
  },
  production: {
    ...defaultStompConfig,
    connectionOptions: {
      ...defaultStompConfig.connectionOptions,
      brokerURL: process.env.STOMP_BROKER_URL_PROD || 'ws://localhost:15674/ws',
      reconnectDelay: 10000,
      heartbeatIncoming: 60000,
      heartbeatOutgoing: 60000,
    },
    reconnect: {
      maxAttempts: 10,
      delay: 10000,
    },
  },
  test: {
    ...defaultStompConfig,
    connectionOptions: {
      ...defaultStompConfig.connectionOptions,
      brokerURL: process.env.STOMP_BROKER_URL_TEST || 'ws://localhost:15674/ws',
      reconnectDelay: 1000,
      heartbeatIncoming: 2000,
      heartbeatOutgoing: 2000,
    },
    reconnect: {
      maxAttempts: 3,
      delay: 1000,
    },
    healthCheck: {
      interval: 10000,
      timeout: 2000,
    },
  },
};

/**
 * Get STOMP configuration for the current environment
 */
export function getStompConfig(
  env: string = process.env.NODE_ENV || 'development',
): MessageServiceConfig {
  const baseConfig = (
    stompConfigs[env as keyof typeof stompConfigs] ||
    stompConfigs.development
  );

  // Create a fresh config with current environment variables
  return {
    ...baseConfig,
    connectionOptions: {
      ...baseConfig.connectionOptions,
      brokerURL: process.env.STOMP_BROKER_URL || baseConfig.connectionOptions.brokerURL,
      connectHeaders: {
        ...baseConfig.connectionOptions.connectHeaders,
        login: process.env.STOMP_LOGIN || baseConfig.connectionOptions.connectHeaders.login,
        passcode: process.env.STOMP_PASSCODE || baseConfig.connectionOptions.connectHeaders.passcode,
        host: process.env.STOMP_VHOST || baseConfig.connectionOptions.connectHeaders.host,
      },
      debug: undefined, // Disable debug to avoid function context issues
      reconnectDelay: parseInt(process.env.STOMP_RECONNECT_DELAY || baseConfig.connectionOptions.reconnectDelay.toString()),
      heartbeatIncoming: parseInt(process.env.STOMP_HEARTBEAT_INCOMING || baseConfig.connectionOptions.heartbeatIncoming.toString()),
      heartbeatOutgoing: parseInt(process.env.STOMP_HEARTBEAT_OUTGOING || baseConfig.connectionOptions.heartbeatOutgoing.toString()),
    },
    reconnect: {
      maxAttempts: parseInt(process.env.STOMP_MAX_RECONNECT_ATTEMPTS || (baseConfig.reconnect?.maxAttempts || 5).toString()),
      delay: parseInt(process.env.STOMP_RECONNECT_DELAY || (baseConfig.reconnect?.delay || 5000).toString()),
    },
    healthCheck: {
      interval: parseInt(process.env.STOMP_HEALTH_CHECK_INTERVAL || (baseConfig.healthCheck?.interval || 30000).toString()),
      timeout: parseInt(process.env.STOMP_HEALTH_CHECK_TIMEOUT || (baseConfig.healthCheck?.timeout || 5000).toString()),
    },
  };
}

/**
 * Validate STOMP configuration
 */
export function validateStompConfig(config: MessageServiceConfig): boolean {
  if (!config.connectionOptions?.brokerURL) {
    console.error('STOMP broker URL is required');
    return false;
  }

  if (!config.connectionOptions.connectHeaders?.login || 
      !config.connectionOptions.connectHeaders?.passcode) {
    console.error('STOMP login and passcode are required');
    return false;
  }

  return true;
}

/**
 * Get validated STOMP configuration
 */
export function getValidatedStompConfig(
  env?: string,
): MessageServiceConfig | null {
  const config = getStompConfig(env);

  if (!validateStompConfig(config)) {
    return null;
  }

  return config;
}

/**
 * STOMP destination mappings
 * Maps RabbitMQ routing keys to STOMP destinations
 */
export const STOMP_DESTINATIONS = {
  // PDF conversion destinations
  PDF_CONVERSION_REQUEST: '/exchange/pdf-conversion-exchange/pdf.conversion.request',
  PDF_CONVERSION_PROGRESS: '/exchange/pdf-conversion-exchange/pdf.conversion.progress',
  PDF_CONVERSION_COMPLETED: '/exchange/pdf-conversion-exchange/pdf.conversion.completed',
  PDF_CONVERSION_FAILED: '/exchange/pdf-conversion-exchange/pdf.conversion.failed',
  
  // PDF analysis destinations
  PDF_ANALYSIS_REQUEST: '/exchange/pdf-conversion-exchange/pdf.analysis.request',
  PDF_ANALYSIS_COMPLETED: '/exchange/pdf-conversion-exchange/pdf.analysis.completed',
  PDF_ANALYSIS_FAILED: '/exchange/pdf-conversion-exchange/pdf.analysis.failed',
  
  // PDF part conversion destinations
  PDF_PART_CONVERSION_REQUEST: '/exchange/pdf-conversion-exchange/pdf.part.conversion.request',
  PDF_PART_CONVERSION_COMPLETED: '/exchange/pdf-conversion-exchange/pdf.part.conversion.completed',
  PDF_PART_CONVERSION_FAILED: '/exchange/pdf-conversion-exchange/pdf.part.conversion.failed',
  
  // PDF merging destinations
  PDF_MERGING_REQUEST: '/exchange/pdf-conversion-exchange/pdf.merging.request',
  PDF_MERGING_PROGRESS: '/exchange/pdf-conversion-exchange/pdf.merging.progress',
  
  // Markdown storage destinations
  MARKDOWN_STORAGE_REQUEST: '/exchange/pdf-conversion-exchange/markdown.storage.request',
  MARKDOWN_STORAGE_COMPLETED: '/exchange/pdf-conversion-exchange/markdown.storage.completed',
  MARKDOWN_STORAGE_FAILED: '/exchange/pdf-conversion-exchange/markdown.storage.failed',
  
  // Markdown part storage destinations
  MARKDOWN_PART_STORAGE_REQUEST: '/exchange/pdf-conversion-exchange/markdown.part.storage.request',
  MARKDOWN_PART_STORAGE_PROGRESS: '/exchange/pdf-conversion-exchange/markdown.part.storage.progress',
  MARKDOWN_PART_STORAGE_COMPLETED: '/exchange/pdf-conversion-exchange/markdown.part.storage.completed',
  MARKDOWN_PART_STORAGE_FAILED: '/exchange/pdf-conversion-exchange/markdown.part.storage.failed',
  
  // Chunking and embedding destinations
  CHUNKING_EMBEDDING_REQUEST: '/exchange/pdf-conversion-exchange/chunking-embedding-request',
  CHUNKING_EMBEDDING_PROGRESS: '/exchange/pdf-conversion-exchange/chunking-embedding-progress',
  CHUNKING_EMBEDDING_COMPLETED: '/exchange/pdf-conversion-exchange/chunking.embedding.completed',
  CHUNKING_EMBEDDING_FAILED: '/exchange/pdf-conversion-exchange/chunking.embedding.failed',
  
  // Dead letter destination
  DEAD_LETTER: '/exchange/pdf-conversion-dlx/pdf.conversion.dlq',
} as const;

/**
 * Get STOMP destination for RabbitMQ routing key
 */
export function getStompDestination(routingKey: string): string {
  // Direct mapping for known routing keys
  const destinationMap: Record<string, string> = {
    'pdf.conversion.request': STOMP_DESTINATIONS.PDF_CONVERSION_REQUEST,
    'pdf.conversion.progress': STOMP_DESTINATIONS.PDF_CONVERSION_PROGRESS,
    'pdf.conversion.completed': STOMP_DESTINATIONS.PDF_CONVERSION_COMPLETED,
    'pdf.conversion.failed': STOMP_DESTINATIONS.PDF_CONVERSION_FAILED,
    'pdf.analysis.request': STOMP_DESTINATIONS.PDF_ANALYSIS_REQUEST,
    'pdf.analysis.completed': STOMP_DESTINATIONS.PDF_ANALYSIS_COMPLETED,
    'pdf.analysis.failed': STOMP_DESTINATIONS.PDF_ANALYSIS_FAILED,
    'pdf.part.conversion.request': STOMP_DESTINATIONS.PDF_PART_CONVERSION_REQUEST,
    'pdf.part.conversion.completed': STOMP_DESTINATIONS.PDF_PART_CONVERSION_COMPLETED,
    'pdf.part.conversion.failed': STOMP_DESTINATIONS.PDF_PART_CONVERSION_FAILED,
    'pdf.merging.request': STOMP_DESTINATIONS.PDF_MERGING_REQUEST,
    'pdf.merging.progress': STOMP_DESTINATIONS.PDF_MERGING_PROGRESS,
    'markdown.storage.request': STOMP_DESTINATIONS.MARKDOWN_STORAGE_REQUEST,
    'markdown.storage.completed': STOMP_DESTINATIONS.MARKDOWN_STORAGE_COMPLETED,
    'markdown.storage.failed': STOMP_DESTINATIONS.MARKDOWN_STORAGE_FAILED,
    'markdown.part.storage.request': STOMP_DESTINATIONS.MARKDOWN_PART_STORAGE_REQUEST,
    'markdown.part.storage.progress': STOMP_DESTINATIONS.MARKDOWN_PART_STORAGE_PROGRESS,
    'markdown.part.storage.completed': STOMP_DESTINATIONS.MARKDOWN_PART_STORAGE_COMPLETED,
    'markdown.part.storage.failed': STOMP_DESTINATIONS.MARKDOWN_PART_STORAGE_FAILED,
    'chunking-embedding-request': STOMP_DESTINATIONS.CHUNKING_EMBEDDING_REQUEST,
    'chunking-embedding-progress': STOMP_DESTINATIONS.CHUNKING_EMBEDDING_PROGRESS,
    'chunking.embedding.completed': STOMP_DESTINATIONS.CHUNKING_EMBEDDING_COMPLETED,
    'chunking.embedding.failed': STOMP_DESTINATIONS.CHUNKING_EMBEDDING_FAILED,
    'pdf.conversion.dlq': STOMP_DESTINATIONS.DEAD_LETTER,
  };

  return destinationMap[routingKey] || `/exchange/pdf-conversion-exchange/${routingKey}`;
}

/**
 * STOMP queue configurations for direct queue access
 */
export const stompQueueConfigs = {
  'pdf-conversion-request': {
    destination: '/queue/pdf-conversion-request',
    durable: true,
  },
  'pdf-conversion-progress': {
    destination: '/queue/pdf-conversion-progress',
    durable: true,
  },
  'pdf-conversion-completed': {
    destination: '/queue/pdf-conversion-completed',
    durable: true,
  },
  'pdf-conversion-failed': {
    destination: '/queue/pdf-conversion-failed',
    durable: true,
  },
  'pdf-analysis-request': {
    destination: '/queue/pdf-analysis-request',
    durable: true,
  },
  'pdf-analysis-completed': {
    destination: '/queue/pdf-analysis-completed',
    durable: true,
  },
  'pdf-analysis-failed': {
    destination: '/queue/pdf-analysis-failed',
    durable: true,
  },
} as const;