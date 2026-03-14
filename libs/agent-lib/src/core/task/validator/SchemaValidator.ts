/**
 * SchemaValidator Implementation
 * 
 * A validator that validates results against a schema (Zod or JSON Schema).
 */

import type { z } from 'zod';
import type {
    IResultValidator,
    ValidationResult,
    CollectedResult,
} from '../types.js';

/**
 * Schema type for validation
 */
export type SchemaType = z.ZodTypeAny | Record<string, unknown>;

/**
 * Configuration for SchemaValidator
 */
export interface SchemaValidatorConfig {
    schema: SchemaType;
    strict?: boolean;
}

/**
 * Validator that validates against a schema
 */
export class SchemaValidator implements IResultValidator {
    readonly type = 'schema';
    private readonly schema: SchemaType;
    private readonly strict: boolean;

    constructor(config: SchemaValidatorConfig) {
        this.schema = config.schema;
        this.strict = config.strict ?? true;
    }

    validate(result: CollectedResult): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if this is a Zod schema
        if (this.isZodSchema(this.schema)) {
            const parseResult = this.schema.safeParse(result.data);

            if (!parseResult.success) {
                for (const issue of parseResult.error.issues) {
                    errors.push(`${issue.path.join('.')}: ${issue.message}`);
                }
            }
        }
        // Check if this is a JSON Schema (plain object)
        else if (this.isJsonSchema(this.schema)) {
            const jsonErrors = this.validateJsonSchema(result.data, this.schema);
            errors.push(...jsonErrors);
        }
        else {
            warnings.push('Unknown schema type, validation skipped');
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            metadata: {
                schemaType: this.isZodSchema(this.schema) ? 'zod' : 'json',
                strict: this.strict,
            },
        };
    }

    /**
     * Check if schema is a Zod schema
     */
    private isZodSchema(schema: SchemaType): schema is z.ZodTypeAny {
        return (
            typeof schema === 'object' &&
            schema !== null &&
            '_def' in schema &&
            'safeParse' in schema &&
            typeof (schema as any).safeParse === 'function'
        );
    }

    /**
     * Check if schema is a JSON Schema
     */
    private isJsonSchema(schema: SchemaType): schema is Record<string, unknown> {
        return (
            typeof schema === 'object' &&
            schema !== null &&
            !this.isZodSchema(schema)
        );
    }

    /**
     * Validate against JSON Schema (basic implementation)
     */
    private validateJsonSchema(data: unknown, schema: Record<string, unknown>): string[] {
        const errors: string[] = [];

        // Basic type validation
        if ('type' in schema) {
            const expectedType = String(schema['type']);
            const actualType = typeof data;

            // Handle null case - null has typeof 'object' but should not validate as object
            if (data === null) {
                if (expectedType !== 'null') {
                    errors.push(`Expected ${expectedType}, got null`);
                }
                return errors;
            }

            // Handle undefined case
            if (data === undefined) {
                if (expectedType !== 'undefined' && expectedType !== 'any') {
                    errors.push(`Expected ${expectedType}, got undefined`);
                }
                return errors;
            }

            // Array type check
            if (expectedType === 'array') {
                if (!Array.isArray(data)) {
                    errors.push(`Expected array, got ${actualType}`);
                }
            }
            // Object type check
            else if (expectedType === 'object') {
                if (actualType !== 'object' || Array.isArray(data)) {
                    errors.push(`Expected object, got ${actualType}`);
                }
            }
            // Primitive type checks
            else if (expectedType !== actualType) {
                errors.push(`Expected ${expectedType}, got ${actualType}`);
            }
        }

        // Required properties validation
        const required = schema['required'];
        if (required && Array.isArray(required) && typeof data === 'object' && data !== null) {
            for (const requiredField of required) {
                if (!(requiredField in data)) {
                    errors.push(`Missing required property: ${requiredField}`);
                }
            }
        }

        // Properties validation
        const properties = schema['properties'];
        if (properties && typeof data === 'object' && data !== null) {
            const props = properties as Record<string, unknown>;
            for (const [key, propSchema] of Object.entries(props)) {
                if (key in data && typeof propSchema === 'object' && propSchema !== null) {
                    const value = (data as Record<string, unknown>)[key];
                    const nestedErrors = this.validateJsonSchema(value, propSchema as Record<string, unknown>);
                    for (const error of nestedErrors) {
                        errors.push(`${key}.${error}`);
                    }
                }
            }
        }

        return errors;
    }
}

/**
 * Factory function to create a SchemaValidator
 */
export function createSchemaValidator(schema: SchemaType, strict = true): SchemaValidator {
    return new SchemaValidator({ schema, strict });
}
