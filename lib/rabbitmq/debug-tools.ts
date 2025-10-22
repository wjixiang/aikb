import { IRabbitMQService } from './rabbitmq-service.interface';
import { mockRabbitMQService, getMockRabbitMQServiceImpl } from './__mocks__/rabbitmq.mock';

/**
 * Debug utility for RabbitMQ service
 * This provides helper functions to inspect and debug the RabbitMQ service
 */
export class RabbitMQDebugTools {
  /**
   * Create a debug wrapper around a RabbitMQ service instance
   * @param service The RabbitMQ service to debug
   * @returns A debug wrapper that logs all method calls
   */
  static createDebugWrapper(service: IRabbitMQService): IRabbitMQService {
    const debugService = {} as IRabbitMQService;

    // Wrap all methods with logging
    const methodNames = [
      'initialize',
      'publishMessage',
      'publishPdfConversionRequest',
      'publishPdfConversionProgress',
      'publishPdfConversionCompleted',
      'publishPdfConversionFailed',
      'publishPdfAnalysisRequest',
      'publishPdfAnalysisCompleted',
      'publishPdfAnalysisFailed',
      'publishPdfPartConversionRequest',
      'publishPdfPartConversionCompleted',
      'publishPdfPartConversionFailed',
      'publishPdfMergingRequest',
      'publishPdfMergingProgress',
      'publishMarkdownStorageRequest',
      'publishMarkdownStorageCompleted',
      'publishMarkdownStorageFailed',
      'publishMarkdownPartStorageRequest',
      'publishMarkdownPartStorageProgress',
      'publishMarkdownPartStorageCompleted',
      'publishMarkdownPartStorageFailed',
      'publishChunkingEmbeddingRequest',
      'publishChunkingEmbeddingProgress',
      'publishChunkingEmbeddingCompleted',
      'publishChunkingEmbeddingFailed',
      'consumeMessages',
      'stopConsuming',
      'getQueueInfo',
      'purgeQueue',
      'healthCheck',
      'close',
      'isConnected',
    ] as const;

    for (const methodName of methodNames) {
      const originalMethod = (service as any)[methodName] as Function;
      
      (debugService as any)[methodName] = async (...args: any[]) => {
        console.log(`[RabbitMQ Debug] Calling ${methodName} with args:`, args);
        
        try {
          const result = await originalMethod.apply(service, args);
          console.log(`[RabbitMQ Debug] ${methodName} returned:`, result);
          return result;
        } catch (error) {
          console.error(`[RabbitMQ Debug] ${methodName} threw error:`, error);
          throw error;
        }
      };
    }

    // Copy the protocol property
    Object.defineProperty(debugService, 'protocol', {
      get: () => {
        console.log(`[RabbitMQ Debug] Getting protocol:`, service.protocol);
        return service.protocol;
      }
    });

    return debugService;
  }

  /**
   * Get a mock service with debug capabilities
   * @returns A mock RabbitMQ service with debug logging
   */
  static getDebugMockService(): IRabbitMQService {
    return this.createDebugWrapper(mockRabbitMQService);
  }

  /**
   * Inspect the internal state of the mock service
   * @returns The internal mock implementation
   */
  static inspectMockService() {
    return getMockRabbitMQServiceImpl();
  }

  /**
   * Create a spy on a specific method of the service
   * @param service The RabbitMQ service
   * @param methodName The method name to spy on
   * @returns An object with call information
   */
  static spyOnMethod(service: IRabbitMQService, methodName: string) {
    const originalMethod = service[methodName] as Function;
    const calls: any[] = [];

    (service as any)[methodName] = (...args: any[]) => {
      calls.push({ args, timestamp: new Date() });
      return originalMethod.apply(service, args);
    };

    return {
      calls,
      reset: () => {
        calls.length = 0;
      },
      restore: () => {
        (service as any)[methodName] = originalMethod;
      }
    };
  }
}

/**
 * Convenience function to get a debug-enabled mock service
 */
export function getDebugMockRabbitMQService(): IRabbitMQService {
  return RabbitMQDebugTools.getDebugMockService();
}