/**
 * CustomValidator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    CustomValidator,
    createCustomValidator,
    createSimpleValidator,
    createPredicateValidator,
} from '../validator/CustomValidator.js';
import type { CollectedResult } from '../types.js';

describe('CustomValidator', () => {
    describe('synchronous validation', () => {
        it('should validate synchronously', async () => {
            const validator = new CustomValidator({
                name: 'test-validator',
                validate: (data) => ({
                    isValid: typeof data === 'string',
                    errors: typeof data !== 'string' ? ['Must be a string'] : undefined,
                }),
            });

            const validResult: CollectedResult = {
                type: 'test',
                data: 'string data',
                timestamp: Date.now(),
            };

            const invalidResult: CollectedResult = {
                type: 'test',
                data: 123,
                timestamp: Date.now(),
            };

            const validValidation = await validator.validate(validResult);
            const invalidValidation = await validator.validate(invalidResult);

            expect(validValidation.isValid).toBe(true);
            expect(validValidation.metadata?.validatorType).toBe('test-validator');

            expect(invalidValidation.isValid).toBe(false);
            expect(invalidValidation.errors).toContain('Must be a string');
        });

        it('should use validateSync for synchronous validators', () => {
            const validator = new CustomValidator({
                name: 'test-validator',
                validate: (data) => ({
                    isValid: true,
                }),
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = validator.validateSync(result);

            expect(validation.isValid).toBe(true);
        });

        it('should throw error when using validateSync on async validator', () => {
            const validator = new CustomValidator({
                name: 'async-validator',
                validate: async (data) => ({
                    isValid: true,
                }),
                async: true,
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            expect(() => validator.validateSync(result)).toThrow();
        });
    });

    describe('asynchronous validation', () => {
        it('should validate asynchronously', async () => {
            const validator = new CustomValidator({
                name: 'async-validator',
                validate: async (data) => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return {
                        isValid: typeof data === 'string',
                    };
                },
                async: true,
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test string',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.isValid).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle validation errors', async () => {
            const validator = new CustomValidator({
                name: 'error-validator',
                validate: () => {
                    throw new Error('Validation failed');
                },
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Validation failed');
        });

        it('should handle non-Error errors', async () => {
            const validator = new CustomValidator({
                name: 'error-validator',
                validate: () => {
                    throw 'String error';
                },
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('String error');
        });
    });

    describe('metadata', () => {
        it('should include validator type in metadata', async () => {
            const validator = new CustomValidator({
                name: 'my-validator',
                validate: () => ({ isValid: true }),
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.metadata?.validatorType).toBe('my-validator');
        });
    });

    describe('createCustomValidator factory', () => {
        it('should create synchronous validator by default', () => {
            const validator = createCustomValidator(
                'test',
                (data) => ({ isValid: true })
            );

            expect(validator.type).toBe('test');
            expect((validator as any).isAsync).toBe(false);
        });

        it('should create async validator when specified', () => {
            const validator = createCustomValidator(
                'async-test',
                async (data) => ({ isValid: true }),
                true
            );

            expect((validator as any).isAsync).toBe(true);
        });
    });

    describe('createSimpleValidator helper', () => {
        it('should create validator from check function', async () => {
            const validator = createSimpleValidator(
                'non-empty',
                (data) => data !== '' && data !== null && data !== undefined
            );

            const validResult: CollectedResult = {
                type: 'test',
                data: 'some data',
                timestamp: Date.now(),
            };

            const invalidResult: CollectedResult = {
                type: 'test',
                data: '',
                timestamp: Date.now(),
            };

            const validValidation = await validator.validate(validResult);
            const invalidValidation = await validator.validate(invalidResult);

            expect(validValidation.isValid).toBe(true);
            expect(invalidValidation.isValid).toBe(false);
            expect(invalidValidation.errors).toContain('Validation failed for non-empty');
        });

        it('should use custom error message', async () => {
            const validator = createSimpleValidator(
                'custom',
                () => false,
                'Custom error message'
            );

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.errors).toContain('Custom error message');
        });
    });

    describe('createPredicateValidator helper', () => {
        it('should create validator from predicate', async () => {
            const validator = createPredicateValidator(
                'is-positive',
                (data): data is number => typeof data === 'number' && data > 0
            );

            const positiveResult: CollectedResult = {
                type: 'test',
                data: 42,
                timestamp: Date.now(),
            };

            const negativeResult: CollectedResult = {
                type: 'test',
                data: -5,
                timestamp: Date.now(),
            };

            const positiveValidation = await validator.validate(positiveResult);
            const negativeValidation = await validator.validate(negativeResult);

            expect(positiveValidation.isValid).toBe(true);
            expect(negativeValidation.isValid).toBe(false);
        });
    });

    describe('warnings', () => {
        it('should include warnings in validation result', async () => {
            const validator = new CustomValidator({
                name: 'warning-validator',
                validate: (data) => ({
                    isValid: true,
                    warnings: ['This is a warning'],
                }),
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.warnings).toContain('This is a warning');
        });
    });

    describe('custom metadata', () => {
        it('should include custom metadata in validation result', async () => {
            const validator = new CustomValidator({
                name: 'metadata-validator',
                validate: (data) => ({
                    isValid: true,
                    metadata: { customField: 'customValue' },
                }),
            });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = await validator.validate(result);

            expect(validation.metadata?.customField).toBe('customValue');
        });
    });
});
