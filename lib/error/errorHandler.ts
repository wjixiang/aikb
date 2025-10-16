import createLoggerWithPrefix from '../logger';

/**
 * Error handling utility for multi-version chunking and embedding operations
 */
export class ChunkingErrorHandler {
  private static logger = createLoggerWithPrefix('ChunkingErrorHandler');

  /**
   * Handle errors in chunking operations with proper logging and fallback
   */
  static handleChunkingError(
    error: any,
    context: {
      itemId?: string;
      operation: string;
      strategy?: string;
      groupId?: string;
    },
    fallback?: () => any
  ): any {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.logger.error(`Error in ${context.operation}`, {
      error: errorMessage,
      stack: errorStack,
      itemId: context.itemId,
      strategy: context.strategy,
      groupId: context.groupId,
    });

    // Try fallback if provided
    if (fallback) {
      try {
        this.logger.info(`Attempting fallback for ${context.operation}`);
        return fallback();
      } catch (fallbackError) {
        this.logger.error(`Fallback failed for ${context.operation}`, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        });
      }
    }

    // Re-throw the original error if no fallback or fallback failed
    throw error;
  }

  /**
   * Handle errors in embedding operations with proper logging and fallback
   */
  static handleEmbeddingError(
    error: any,
    context: {
      chunkId?: string;
      itemId?: string;
      operation: string;
      provider?: string;
      strategy?: string;
    },
    fallback?: () => any
  ): any {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.logger.error(`Error in ${context.operation}`, {
      error: errorMessage,
      stack: errorStack,
      chunkId: context.chunkId,
      itemId: context.itemId,
      provider: context.provider,
      strategy: context.strategy,
    });

    // Try fallback if provided
    if (fallback) {
      try {
        this.logger.info(`Attempting fallback for ${context.operation}`);
        return fallback();
      } catch (fallbackError) {
        this.logger.error(`Fallback failed for ${context.operation}`, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        });
      }
    }

    // For embedding errors, we might want to return a default embedding
    // instead of throwing an error, depending on the context
    if (context.operation === 'embedChunk') {
      this.logger.warn(`Returning empty embedding for ${context.chunkId} due to error`);
      return null;
    }

    // Re-throw the original error if no fallback or fallback failed
    throw error;
  }

  /**
   * Handle errors in search operations with proper logging and fallback
   */
  static handleSearchError(
    error: any,
    context: {
      operation: string;
      query?: string;
      filter?: any;
      itemId?: string;
    },
    fallback?: () => any
  ): any {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.logger.error(`Error in ${context.operation}`, {
      error: errorMessage,
      stack: errorStack,
      query: context.query,
      filter: context.filter,
      itemId: context.itemId,
    });

    // Try fallback if provided
    if (fallback) {
      try {
        this.logger.info(`Attempting fallback for ${context.operation}`);
        return fallback();
      } catch (fallbackError) {
        this.logger.error(`Fallback failed for ${context.operation}`, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        });
      }
    }

    // For search errors, we might want to return empty results
    // instead of throwing an error, depending on the context
    if (context.operation === 'searchChunks' || context.operation === 'findSimilarChunks') {
      this.logger.warn(`Returning empty results for ${context.operation} due to error`);
      return [];
    }

    // Re-throw the original error if no fallback or fallback failed
    throw error;
  }

  /**
   * Handle errors in storage operations with proper logging and fallback
   */
  static handleStorageError(
    error: any,
    context: {
      operation: string;
      itemId?: string;
      chunkId?: string;
      groupId?: string;
    },
    fallback?: () => any
  ): any {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.logger.error(`Error in ${context.operation}`, {
      error: errorMessage,
      stack: errorStack,
      itemId: context.itemId,
      chunkId: context.chunkId,
      groupId: context.groupId,
    });

    // Try fallback if provided
    if (fallback) {
      try {
        this.logger.info(`Attempting fallback for ${context.operation}`);
        return fallback();
      } catch (fallbackError) {
        this.logger.error(`Fallback failed for ${context.operation}`, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
        });
      }
    }

    // Re-throw the original error if no fallback or fallback failed
    throw error;
  }

  /**
   * Create a standardized error response for API operations
   */
  static createErrorResponse(
    error: any,
    operation: string,
    context?: any
  ): {
    success: false;
    error: string;
    operation: string;
    context?: any;
    timestamp: string;
  } {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      error: errorMessage,
      operation,
      context,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log performance metrics for operations
   */
  static logPerformance(
    operation: string,
    startTime: number,
    context?: {
      itemId?: string;
      chunkCount?: number;
      strategy?: string;
      provider?: string;
    }
  ): void {
    const duration = Date.now() - startTime;
    
    this.logger.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...context,
    });
    
    // Log warnings for slow operations
    if (duration > 5000) {
      this.logger.warn(`Slow operation detected: ${operation} took ${duration}ms`, context);
    }
  }

  /**
   * Validate operation parameters and throw descriptive errors
   */
  static validateParams(
    params: any,
    operation: string,
    requiredParams: string[] = []
  ): void {
    const errors: string[] = [];
    
    // Check required parameters
    for (const param of requiredParams) {
      if (params[param] === undefined || params[param] === null) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }
    
    // Check for empty arrays when they shouldn't be empty
    if (params.itemIds && Array.isArray(params.itemIds) && params.itemIds.length === 0) {
      errors.push('itemIds cannot be empty');
    }
    
    if (params.groups && Array.isArray(params.groups) && params.groups.length === 0) {
      errors.push('groups cannot be empty');
    }
    
    if (params.chunks && Array.isArray(params.chunks) && params.chunks.length === 0) {
      errors.push('chunks cannot be empty');
    }
    
    // Check vector dimensions
    if (params.queryVector && (!Array.isArray(params.queryVector) || params.queryVector.length === 0)) {
      errors.push('queryVector must be a non-empty array');
    }
    
    if (errors.length > 0) {
      const error = new Error(`Invalid parameters for ${operation}: ${errors.join(', ')}`);
      this.logger.error(`Parameter validation failed for ${operation}`, { errors, params });
      throw error;
    }
  }

  /**
   * Create a retry wrapper for operations that might fail temporarily
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    context: {
      operation: string;
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    }
  ): Promise<T> {
    const maxRetries = context.maxRetries || 3;
    const retryDelay = context.retryDelay || 1000;
    const backoffMultiplier = context.backoffMultiplier || 2;
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          this.logger.error(`Operation ${context.operation} failed after ${maxRetries} retries`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            attempts: attempt + 1,
          });
          throw error;
        }
        
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
        this.logger.warn(`Operation ${context.operation} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError;
  }
}