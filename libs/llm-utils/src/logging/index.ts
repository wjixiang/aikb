/**
 * @fileoverview Main entry point for the compact logging system
 * Provides a default logger instance with Jest environment detection
 */

/**
 * No-operation logger implementation for production environments
 */
const noopLogger = {
  debug: () => { },
  info: () => { },
  warn: () => { },
  error: () => { },
  fatal: () => { },
  child: () => noopLogger,
  close: () => { },
};

/**
 * Default logger instance
 * Uses CompactLogger for normal operation, switches to noop logger in Jest test environment or jsdom
 */
let loggerInstance: typeof noopLogger;

// Only create actual logger in Node.js environment (not in browser/jsdom)
if (process.env['NODE_ENV'] === 'test' && typeof window === 'undefined') {
  // Use require to avoid ES module import issues in browser environments
  try {
    const { CompactLogger } = require('./CompactLogger');
    loggerInstance = new CompactLogger();
  } catch (error) {
    // Fallback to noop logger if import fails
    loggerInstance = noopLogger;
  }
} else {
  loggerInstance = noopLogger;
}

export const logger = loggerInstance;
