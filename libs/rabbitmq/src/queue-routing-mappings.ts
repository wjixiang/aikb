/**
 * Unified queue to routing key mappings
 * This file provides a centralized mapping between queue names and routing keys
 * for both AMQP and STOMP protocols, eliminating duplication
 */

/**
 * Queue to routing key mapping configuration
 */
export const QUEUE_TO_ROUTING_KEY_MAP: Record<string, string> = {
  // PDF conversion queues
  'pdf-conversion-request': 'pdf.conversion.request',
  'pdf-conversion-progress': 'pdf.conversion.progress',
  'pdf-conversion-completed': 'pdf.conversion.completed',
  'pdf-conversion-failed': 'pdf.conversion.failed',

  // PDF analysis queues
  'pdf-analysis-request': 'pdf.analysis.request',
  'pdf-analysis-completed': 'pdf.analysis.completed',
  'pdf-analysis-failed': 'pdf.analysis.failed',

  // PDF part conversion queues
  'pdf-part-conversion-request': 'pdf.part.conversion.request',
  'pdf-part-conversion-completed': 'pdf.part.conversion.completed',
  'pdf-part-conversion-failed': 'pdf.part.conversion.failed',

  // PDF merging queues
  'pdf-merging-request': 'pdf.merging.request',
  'pdf-merging-progress': 'pdf.merging.progress',

  // Markdown storage queues
  'markdown-storage-request': 'markdown.storage.request',
  'markdown-storage-completed': 'markdown.storage.completed',
  'markdown-storage-failed': 'markdown.storage.failed',

  // Markdown part storage queues
  'markdown-part-storage-request': 'markdown.part.storage.request',
  'markdown-part-storage-progress': 'markdown.part.storage.progress',
  'markdown-part-storage-completed': 'markdown.part.storage.completed',
  'markdown-part-storage-failed': 'markdown.part.storage.failed',

  // Chunking and embedding queues
  'chunking-embedding-request': 'chunking.embedding.request',
  'chunking-embedding-progress': 'chunking.embedding.progress',
  'chunking-embedding-completed': 'chunking-embedding-completed',
  'chunking-embedding-failed': 'chunking-embedding-failed',

  // Dead letter queue
  'pdf-conversion-dlq': 'pdf.conversion.dlq',
};

/**
 * Get routing key for a given queue name
 * @param queueName - The queue name
 * @returns The corresponding routing key
 */
export function getRoutingKeyForQueue(queueName: string): string {
  const routingKey = QUEUE_TO_ROUTING_KEY_MAP[queueName];
  if (!routingKey) {
    throw new Error(`No routing key mapping found for queue: ${queueName}`);
  }
  return routingKey;
}

/**
 * Check if a queue has a routing key mapping
 * @param queueName - The queue name
 * @returns True if mapping exists, false otherwise
 */
export function hasRoutingKeyMapping(queueName: string): boolean {
  return queueName in QUEUE_TO_ROUTING_KEY_MAP;
}

/**
 * Get all queue names that have mappings
 * @returns Array of queue names
 */
export function getAllMappedQueueNames(): string[] {
  return Object.keys(QUEUE_TO_ROUTING_KEY_MAP);
}

/**
 * Get all routing keys
 * @returns Array of routing keys
 */
export function getAllRoutingKeys(): string[] {
  return Object.values(QUEUE_TO_ROUTING_KEY_MAP);
}

/**
 * Add a new queue to routing key mapping
 * @param queueName - The queue name
 * @param routingKey - The routing key
 */
export function addQueueRoutingMapping(
  queueName: string,
  routingKey: string,
): void {
  if (QUEUE_TO_ROUTING_KEY_MAP[queueName]) {
    console.warn(
      `Overriding existing mapping for queue ${queueName}: ${QUEUE_TO_ROUTING_KEY_MAP[queueName]} -> ${routingKey}`,
    );
  }
  QUEUE_TO_ROUTING_KEY_MAP[queueName] = routingKey;
}

/**
 * Remove a queue to routing key mapping
 * @param queueName - The queue name
 * @returns True if mapping was removed, false if it didn't exist
 */
export function removeQueueRoutingMapping(queueName: string): boolean {
  if (queueName in QUEUE_TO_ROUTING_KEY_MAP) {
    delete QUEUE_TO_ROUTING_KEY_MAP[queueName];
    return true;
  }
  return false;
}
