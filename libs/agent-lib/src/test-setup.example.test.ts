/**
 * Example test file demonstrating how to use the global test setup
 * and environment variable injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testHelpers } from './test-setup.js';

describe('Global Test Setup Examples', () => {
    describe('Environment Variables from Global Setup', () => {
        it('should have NODE_ENV set to test', () => {
            expect(process.env.NODE_ENV).toBe('test');
        });

        it('should have TEST_MODE set to true', () => {
            expect(process.env.TEST_MODE).toBe('true');
        });

        it('should have LOG_LEVEL set', () => {
            expect(process.env.LOG_LEVEL).toBeDefined();
        });

        it('should have AGENT_DATABASE_URL set', () => {
            expect(process.env.AGENT_DATABASE_URL).toBeDefined();
        });
    });

    describe('Using testHelpers for Dynamic Environment Variables', () => {
        afterEach(() => {
            // Clean up stubbed environment variables after each test
            testHelpers.restoreTestEnv();
        });

        it('should set custom environment variables for a test', () => {
            testHelpers.setTestEnv({
                CUSTOM_VAR: 'custom-value',
                ANOTHER_VAR: 'another-value',
            });

            expect(process.env.CUSTOM_VAR).toBe('custom-value');
            expect(process.env.ANOTHER_VAR).toBe('another-value');
        });

        it('should restore environment variables after test', () => {
            // Set a custom variable
            testHelpers.setTestEnv({ TEMP_VAR: 'temp-value' });
            expect(process.env.TEMP_VAR).toBe('temp-value');

            // Restore will be called in afterEach
        });

        it('should not have TEMP_VAR in next test', () => {
            // This verifies that afterEach properly cleaned up
            expect(process.env.TEMP_VAR).toBeUndefined();
        });
    });

    describe('Using testHelpers.getEnv', () => {
        it('should get existing environment variable', () => {
            const logLevel = testHelpers.getEnv('LOG_LEVEL');
            expect(logLevel).toBeDefined();
        });

        it('should return default value for missing environment variable', () => {
            const missing = testHelpers.getEnv('MISSING_VAR', 'default-value');
            expect(missing).toBe('default-value');
        });
    });

    describe('Using vi.stubEnv directly', () => {
        beforeEach(() => {
            // Alternative way to stub environment variables
            vi.stubEnv('DIRECT_STUB', 'stubbed-value');
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('should have directly stubbed environment variable', () => {
            expect(process.env.DIRECT_STUB).toBe('stubbed-value');
        });
    });
});

describe('Real-world Example: Testing with Environment Variables', () => {
    afterEach(() => {
        testHelpers.restoreTestEnv();
    });

    it('should test database connection with test database URL', () => {
        // Simulate testing with database URL
        const dbUrl = process.env.AGENT_DATABASE_URL;
        expect(dbUrl).toBeDefined();
        expect(dbUrl).toContain('test_db');
    });

    it('should test API behavior with test API key', () => {
        // Set a test API key for this specific test
        testHelpers.setTestEnv({
            API_KEY: 'test-api-key-12345',
        });

        // Simulate API call that uses API_KEY
        const apiKey = process.env.API_KEY;
        expect(apiKey).toBe('test-api-key-12345');
    });
});
