/**
 * Core types for Workspace - EditableStatus interaction architecture
 */

import { z, ZodType, ZodTypeDef } from 'zod';

/**
 * Enhanced EditableStatus interface with Zod schema support
 *
 * This interface allows EditableStatus to accept any Zod-based object schema,
 * enabling:
 * 1. Rendering the schema as a prompt for LLM to understand how to write values
 * 2. Validating LLM tool call parameters against the schema
 */
export interface EditableStatus<TInput = any, TOutput = TInput, TDef extends ZodTypeDef = ZodTypeDef> {
    /**
     * Current value of the editable status field
     */
    value: TOutput | null;

    /**
     * Zod schema for validation and type safety
     * This schema defines the structure and constraints of the field
     */
    schema: ZodType<TOutput, TDef, TInput>;

    /**
     * Human-readable description of the field
     * Used to inform the LLM about the purpose of this field
     */
    description: string;

    /**
     * Whether this field is read-only
     * If true, the LLM cannot modify this field
     */
    readonly: boolean;

    /**
     * Optional: Fields this field depends on
     * Used for conditional validation or rendering
     */
    dependsOn?: string[];
}

/**
 * Result of updating an editable status field
 */
export interface EditableStatusUpdateResult {
    success: boolean;
    error?: string;
    updatedField?: string;
    previousValue?: any;
    newValue?: any;
    data?: any; // Optional data returned from action fields
}

/**
 * Validation result for an editable status field
 */
export interface EditableStatusValidationResult {
    valid: boolean;
    error?: string;
    data?: any;
}

/**
 * Render a Zod schema as a human-readable prompt for LLM
 * This converts the schema into a format that LLMs can understand
 * 
 * @param schema - The Zod schema to render
 * @param fieldName - The name of the field (for context)
 * @param description - Optional description to include
 * @returns A string representation of the schema for LLM consumption
 */
export function renderSchemaAsPrompt<TInput, TOutput, TDef extends ZodTypeDef>(
    schema: ZodType<TOutput, TDef, TInput>,
    fieldName: string,
    description?: string
): string {
    const zodType = (schema as any)._def.typeName;
    let typeDescription = '';

    switch (zodType) {
        case 'ZodString':
            typeDescription = 'string';
            break;
        case 'ZodNumber':
            typeDescription = 'number';
            break;
        case 'ZodBoolean':
            typeDescription = 'boolean';
            break;
        case 'ZodEnum':
            const enumValues = (schema as unknown as z.ZodEnum<any>)._def.values;
            typeDescription = `enum (${enumValues.map((v: any) => `"${v}"`).join(', ')})`;
            break;
        case 'ZodObject':
            const shape = (schema as unknown as z.ZodObject<any>)._def.shape();
            const fields = Object.entries(shape).map(([key, fieldSchema]: [string, any]) => {
                const fieldDesc = renderSchemaAsPrompt(fieldSchema, key);
                return `  ${fieldDesc}`;
            }).join('\n');
            typeDescription = `object with fields:\n${fields}`;
            break;
        case 'ZodArray':
            const arraySchema = (schema as unknown as z.ZodArray<any>);
            const elementType = renderSchemaAsPrompt(arraySchema.element, 'element');
            typeDescription = `array of ${elementType}`;
            break;
        case 'ZodOptional':
            const innerType = renderSchemaAsPrompt((schema as unknown as z.ZodOptional<any>)._def.innerType, fieldName);
            typeDescription = `${innerType} (optional)`;
            break;
        case 'ZodNullable':
            const nullableType = renderSchemaAsPrompt((schema as unknown as z.ZodNullable<any>)._def.innerType, fieldName);
            typeDescription = `${nullableType} (nullable)`;
            break;
        case 'ZodUnion':
            const unionOptions = (schema as unknown as z.ZodUnion<any>)._def.options;
            const unionTypes = unionOptions.map((opt: any) => renderSchemaAsPrompt(opt, fieldName)).join(' | ');
            typeDescription = unionTypes;
            break;
        case 'ZodLiteral':
            const literalValue = (schema as unknown as z.ZodLiteral<any>)._def.value;
            typeDescription = typeof literalValue === 'string' ? `"${literalValue}"` : String(literalValue);
            break;
        case 'ZodDefault':
            const defaultSchema = (schema as unknown as z.ZodDefault<any>)._def.innerType;
            const defaultValue = (schema as unknown as z.ZodDefault<any>)._def.defaultValue();
            const defaultType = renderSchemaAsPrompt(defaultSchema, fieldName);
            typeDescription = `${defaultType} (default: ${JSON.stringify(defaultValue)})`;
            break;
        default:
            typeDescription = zodType;
    }

    // Add constraints if available
    let constraints = '';
    if (zodType === 'ZodString') {
        const checks = (schema as unknown as z.ZodString)._def.checks;
        if (checks && checks.length > 0) {
            const constraintList = checks.map((check: any) => {
                switch (check.kind) {
                    case 'min':
                        return `minimum length: ${check.value}`;
                    case 'max':
                        return `maximum length: ${check.value}`;
                    case 'email':
                        return 'must be a valid email';
                    case 'url':
                        return 'must be a valid URL';
                    case 'regex':
                        return `must match pattern: ${check.regex}`;
                    default:
                        return check.kind;
                }
            });
            if (constraintList.length > 0) {
                constraints = ` [${constraintList.join(', ')}]`;
            }
        }
    } else if (zodType === 'ZodNumber') {
        const checks = (schema as unknown as z.ZodNumber)._def.checks;
        if (checks && checks.length > 0) {
            const constraintList = checks.map((check: any) => {
                switch (check.kind) {
                    case 'min':
                        return `minimum: ${check.value}`;
                    case 'max':
                        return `maximum: ${check.value}`;
                    case 'int':
                        return 'must be an integer';
                    case 'positive':
                        return 'must be positive';
                    case 'nonnegative':
                        return 'must be non-negative';
                    default:
                        return check.kind;
                }
            });
            if (constraintList.length > 0) {
                constraints = ` [${constraintList.join(', ')}]`;
            }
        }
    }

    const desc = description ? ` - ${description}` : '';
    return `${fieldName}: ${typeDescription}${constraints}${desc}`;
}

/**
 * Validate a value against an EditableStatus's schema
 * 
 * @param editableStatus - The EditableStatus to validate against
 * @param value - The value to validate
 * @returns Validation result with success/error information
 */
export function validateEditableStatus<TInput, TOutput, TDef extends ZodTypeDef>(
    editableStatus: EditableStatus<TInput, TOutput, TDef>,
    value: any
): EditableStatusValidationResult {
    try {
        // Handle null values if the schema allows them
        if (value === null || value === undefined) {
            const result = editableStatus.schema.safeParse(null);
            if (result.success) {
                return { valid: true, data: null };
            }
        }

        const result = editableStatus.schema.safeParse(value);
        if (result.success) {
            return { valid: true, data: result.data };
        } else {
            const errors = result.error.errors.map(e => {
                const path = e.path.length > 0 ? e.path.join('.') : 'value';
                return `${path}: ${e.message}`;
            }).join('; ');
            return { valid: false, error: errors };
        }
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown validation error'
        };
    }
}

/**
 * Render an EditableStatus as a prompt for LLM
 * This generates a human-readable description that LLMs can use to understand
 * how to properly set the value
 * 
 * @param fieldName - The name of the field
 * @param editableStatus - The EditableStatus to render
 * @returns A string representation for LLM consumption
 */
export function renderEditableStatusAsPrompt<TInput, TOutput, TDef extends ZodTypeDef>(
    fieldName: string,
    editableStatus: EditableStatus<TInput, TOutput, TDef>
): string {
    const readonlyMark = editableStatus.readonly ? ' [READ-ONLY]' : '';
    const currentValue = editableStatus.value !== null
        ? ` (current: ${JSON.stringify(editableStatus.value)})`
        : ' (not set)';

    const schemaPrompt = renderSchemaAsPrompt(editableStatus.schema, fieldName, editableStatus.description);

    return `${schemaPrompt}${readonlyMark}${currentValue}`;
}

/**
 * Schema definition for all editable status fields
 */
export interface EditableStatusSchema {
    fields: Record<string, any>;
}
