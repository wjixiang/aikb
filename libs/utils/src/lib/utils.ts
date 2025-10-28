import { v4 } from 'uuid';

/**
 * Utility functions for generating IDs without database dependency
 */
export class IdUtils {
  /**
   * Generate a unique ID using uuidv4
   */
  static generateId(): string {
    return v4();
  }

  /**
   * Generate a UUID using uuidv4
   */
  static generateUUID(): string {
    return v4();
  }
}
