export class AssertionError extends Error {
  constructor(message: string, public expected: any, public actual: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

export const assert = {
  /**
   * Assert equality
   */
  equal(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${expected} but got ${actual}`,
        expected,
        actual
      );
    }
  },

  /**
   * Deep equality
   */
  deepEqual(actual: any, expected: any, message?: string): void {
    if (!this.isDeepEqual(actual, expected)) {
      throw new AssertionError(
        message ||
        `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
        expected,
        actual
      );
    }
  },

  /**
   * Assert contains
   */
  contains(actual: any, expected: any, message?: string): void {
    if (Array.isArray(actual)) {
      if (!actual.includes(expected)) {
        throw new AssertionError(
          message || `Expected array to contain ${expected}`,
          expected,
          actual
        );
      }
    } else if (typeof actual === 'string') {
      if (!actual.includes(expected)) {
        throw new AssertionError(
          message || `Expected string to contain "${expected}"`,
          expected,
          actual
        );
      }
    } else if (typeof actual === 'object') {
      if (!(expected in actual)) {
        throw new AssertionError(
          message || `Expected object to have key "${expected}"`,
          expected,
          actual
        );
      }
    }
  },

  /**
   * Assert matches regex
   */
  matches(actual: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(actual)) {
      throw new AssertionError(
        message || `Expected "${actual}" to match ${pattern}`,
        pattern,
        actual
      );
    }
  },

  /**
   * Assert type
   */
  isType(actual: any, expectedType: string, message?: string): void {
    const actualType = typeof actual;
    if (actualType !== expectedType) {
      throw new AssertionError(
        message || `Expected type ${expectedType} but got ${actualType}`,
        expectedType,
        actualType
      );
    }
  },

  /**
   * Assert array length
   */
  hasLength(actual: any[], expectedLength: number, message?: string): void {
    if (actual.length !== expectedLength) {
      throw new AssertionError(
        message || `Expected length ${expectedLength} but got ${actual.length}`,
        expectedLength,
        actual.length
      );
    }
  },

  /**
   * Assert object has property
   */
  hasProperty(actual: object, property: string, message?: string): void {
    if (!(property in actual)) {
      throw new AssertionError(
        message || `Expected object to have property "${property}"`,
        property,
        actual
      );
    }
  },

  /**
   * Assert in range
   */
  inRange(actual: number, min: number, max: number, message?: string): void {
    if (actual < min || actual > max) {
      throw new AssertionError(
        message || `Expected ${actual} to be between ${min} and ${max}`,
        { min, max },
        actual
      );
    }
  },

  /**
   * Assert throws error
   */
  async throws(fn: () => any | Promise<any>, message?: string): Promise<void> {
    try {
      await fn();
      throw new AssertionError(
        message || 'Expected function to throw an error',
        'Error',
        'No error'
      );
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      }
      // Expected error
    }
  },

  /**
   * Assert does not throw
   */
  async doesNotThrow(fn: () => any | Promise<any>, message?: string): Promise<void> {
    try {
      await fn();
    } catch (error) {
      throw new AssertionError(
        message || `Expected function not to throw, but got: ${error}`,
        'No error',
        error
      );
    }
  },

  /**
   * Assert truthy
   */
  truthy(actual: any, message?: string): void {
    if (!actual) {
      throw new AssertionError(
        message || `Expected truthy value but got ${actual}`,
        'truthy',
        actual
      );
    }
  },

  /**
   * Assert falsy
   */
  falsy(actual: any, message?: string): void {
    if (actual) {
      throw new AssertionError(
        message || `Expected falsy value but got ${actual}`,
        'falsy',
        actual
      );
    }
  },

  /**
   * Custom assertion
   */
  custom(condition: boolean, message: string, expected?: any, actual?: any): void {
    if (!condition) {
      throw new AssertionError(message, expected, actual);
    }
  },

  // Helper method
  isDeepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.isDeepEqual(a[key], b[key])) return false;
    }

    return true;
  }
};