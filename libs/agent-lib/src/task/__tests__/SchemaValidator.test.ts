/**
 * SchemaValidator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator, createSchemaValidator } from '../validator/SchemaValidator.js';
import type { CollectedResult } from '../types.js';

describe('SchemaValidator', () => {
    describe('with JSON Schema', () => {
        let validator: SchemaValidator;

        beforeEach(() => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                    email: { type: 'string' },
                },
                required: ['name', 'age'],
            };

            validator = new SchemaValidator({ schema, strict: true });
        });

        describe('type', () => {
            it('should have type "schema"', () => {
                expect(validator.type).toBe('schema');
            });
        });

        describe('validate with valid data', () => {
            it('should pass validation for valid object', () => {
                const result: CollectedResult = {
                    type: 'test',
                    data: {
                        name: 'John Doe',
                        age: 30,
                        email: 'john@example.com',
                    },
                    timestamp: Date.now(),
                };

                const validation = validator.validate(result);

                expect(validation.isValid).toBe(true);
                expect(validation.errors).toBeUndefined();
            });

            it('should pass validation with optional fields missing', () => {
                const result: CollectedResult = {
                    type: 'test',
                    data: {
                        name: 'Jane Doe',
                        age: 25,
                    },
                    timestamp: Date.now(),
                };

                const validation = validator.validate(result);

                expect(validation.isValid).toBe(true);
            });
        });

        describe('validate with invalid data', () => {
            it('should fail validation for missing required field', () => {
                const result: CollectedResult = {
                    type: 'test',
                    data: {
                        name: 'John Doe',
                        // age is missing
                    },
                    timestamp: Date.now(),
                };

                const validation = validator.validate(result);

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toBeDefined();
                expect(validation.errors?.some(e => e.includes('age'))).toBe(true);
            });

            it('should fail validation for wrong type', () => {
                const result: CollectedResult = {
                    type: 'test',
                    data: {
                        name: 'John Doe',
                        age: '30', // Should be number
                    },
                    timestamp: Date.now(),
                };

                const validation = validator.validate(result);

                expect(validation.isValid).toBe(false);
                expect(validation.errors).toBeDefined();
            });

            it('should fail validation for non-object data', () => {
                const result: CollectedResult = {
                    type: 'test',
                    data: 'just a string',
                    timestamp: Date.now(),
                };

                const validation = validator.validate(result);

                expect(validation.isValid).toBe(false);
            });
        });

        describe('nested object validation', () => {
            it('should validate nested properties', () => {
                const schema = {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                age: { type: 'number' },
                            },
                            required: ['name'],
                        },
                    },
                };

                const validator = new SchemaValidator({ schema });

                const validResult: CollectedResult = {
                    type: 'test',
                    data: {
                        user: {
                            name: 'John',
                            age: 30,
                        },
                    },
                    timestamp: Date.now(),
                };

                const invalidResult: CollectedResult = {
                    type: 'test',
                    data: {
                        user: {
                            age: 30, // name is missing
                        },
                    },
                    timestamp: Date.now(),
                };

                expect(validator.validate(validResult).isValid).toBe(true);
                expect(validator.validate(invalidResult).isValid).toBe(false);
            });
        });
    });

    describe('array validation', () => {
        it('should validate arrays correctly', () => {
            const schema = {
                type: 'array',
            };

            const validator = new SchemaValidator({ schema });

            const arrayResult: CollectedResult = {
                type: 'test',
                data: [1, 2, 3],
                timestamp: Date.now(),
            };

            const objectResult: CollectedResult = {
                type: 'test',
                data: { not: 'array' },
                timestamp: Date.now(),
            };

            expect(validator.validate(arrayResult).isValid).toBe(true);
            expect(validator.validate(objectResult).isValid).toBe(false);
        });
    });

    describe('metadata', () => {
        it('should include schema type in metadata', () => {
            const schema = { type: 'string' };
            const validator = new SchemaValidator({ schema });

            const result: CollectedResult = {
                type: 'test',
                data: 'test string',
                timestamp: Date.now(),
            };

            const validation = validator.validate(result);

            expect(validation.metadata).toBeDefined();
            expect(validation.metadata?.schemaType).toBe('json');
        });

        it('should include strict flag in metadata', () => {
            const schema = { type: 'string' };
            const validator = new SchemaValidator({ schema, strict: false });

            const result: CollectedResult = {
                type: 'test',
                data: 'test',
                timestamp: Date.now(),
            };

            const validation = validator.validate(result);

            expect(validation.metadata?.strict).toBe(false);
        });
    });

    describe('createSchemaValidator factory', () => {
        it('should create with strict=true by default', () => {
            const schema = { type: 'string' };
            const validator = createSchemaValidator(schema);

            expect((validator as any).strict).toBe(true);
        });

        it('should create with custom strict flag', () => {
            const schema = { type: 'string' };
            const validator = createSchemaValidator(schema, false);

            expect((validator as any).strict).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle empty schema', () => {
            const schema = {};
            const validator = new SchemaValidator({ schema });

            const result: CollectedResult = {
                type: 'test',
                data: 'anything',
                timestamp: Date.now(),
            };

            const validation = validator.validate(result);

            // Empty schema should pass
            expect(validation.isValid).toBe(true);
        });

        it('should handle null data', () => {
            const schema = { type: 'object' };
            const validator = new SchemaValidator({ schema });

            const result: CollectedResult = {
                type: 'test',
                data: null,
                timestamp: Date.now(),
            };

            const validation = validator.validate(result);

            expect(validation.isValid).toBe(false);
        });

        it('should handle undefined data', () => {
            const schema = { type: 'string' };
            const validator = new SchemaValidator({ schema });

            const result: CollectedResult = {
                type: 'test',
                data: undefined,
                timestamp: Date.now(),
            };

            const validation = validator.validate(result);

            expect(validation.isValid).toBe(false);
        });
    });
});
