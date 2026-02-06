/**
 * Global test setup file for agent-lib
 * 
 * This file is executed before all tests run and sets up the test environment,
 * including loading environment variables and configuring global test behavior.
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Store original environment variables for cleanup
let originalEnv: NodeJS.ProcessEnv;

/**
 * Load test environment variables from .test.env file
 * This function uses dotenv to load environment variables specifically for testing
 */
async function loadTestEnv() {
    try {
        // Dynamic import of dotenv to avoid issues if it's not installed
        const { default: dotenv } = await import('dotenv');

        // Try to load .test.env first, fall back to .env
        const result = dotenv.config({ path: '.test.env' });

        dotenv.config({ path: '.env' });

    } catch (error) {
        // dotenv not available, continue without it
        console.warn('dotenv not available, skipping .env file loading');
    }
}

/**
 * Set default test environment variables
 * These can be overridden by .test.env or individual test files
 */
function setDefaultTestEnv() {
    // Set test mode flag
    process.env.NODE_ENV = 'test';
    process.env.TEST_MODE = 'true';

    // Set default log level for tests (can be overridden)
    if (!process.env.LOG_LEVEL) {
        process.env.LOG_LEVEL = 'error'; // Only show errors in tests by default
    }

    // Set test database URLs if not already set
    if (!process.env.AGENT_DATABASE_URL) {
        process.env.AGENT_DATABASE_URL = 'postgresql://user:password@localhost:5432/test_db?schema=agent_test';
    }
}

/**
 * Configure global test behavior
 */
function configureGlobalTestBehavior() {
    // Increase timeout for integration tests
    vi.setConfig({ testTimeout: 10000 });

    // Mock console methods to reduce noise in test output
    // Uncomment if needed:
    // vi.spyOn(console, 'log').mockImplementation(() => {});
    // vi.spyOn(console, 'info').mockImplementation(() => {});
    // vi.spyOn(console, 'warn').mockImplementation(() => {});
}

beforeAll(async () => {
    // Store original environment variables for cleanup
    originalEnv = { ...process.env };

    // Load environment variables from .test.env or .env
    await loadTestEnv();

    // Set default test environment variables
    setDefaultTestEnv();

    // Configure global test behavior
    configureGlobalTestBehavior();

    console.log('[Test Setup] Environment initialized');
});

afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;

    console.log('[Test Setup] Environment restored');
});

// Export helper functions for use in test files
export const testHelpers = {
    /**
     * Set environment variables for a specific test
     * Automatically cleaned up after the test
     */
    setTestEnv: (vars: Record<string, string>) => {
        Object.entries(vars).forEach(([key, value]) => {
            vi.stubEnv(key, value);
        });
    },

    /**
     * Restore all stubbed environment variables
     */
    restoreTestEnv: () => {
        vi.unstubAllEnvs();
    },

    /**
     * Get a test environment variable with a default value
     */
    getEnv: (key: string, defaultValue?: string): string | undefined => {
        return process.env[key] || defaultValue;
    },
};
