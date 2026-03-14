/**
 * CustomValidator Implementation
 * 
 * A validator that uses custom validation logic provided by the user.
 */

import type {
    IResultValidator,
    ValidationResult,
    CollectedResult,
} from '../types.js';

/**
 * Custom validation function signature
 */
export type CustomValidationFunction = (
    data: unknown,
    result: CollectedResult
) => ValidationResult | Promise<ValidationResult>;

/**
 * Configuration for CustomValidator
 */
export interface CustomValidatorConfig {
    name: string;
    validate: CustomValidationFunction;
    async?: boolean;
}

/**
 * Validator that uses custom validation logic
 */
export class CustomValidator implements IResultValidator {
    readonly type: string;
    private readonly validateFn: CustomValidationFunction;
    private readonly isAsync: boolean;

    constructor(config: CustomValidatorConfig) {
        this.type = config.name;
        this.validateFn = config.validate;
        this.isAsync = config.async ?? false;
    }

    async validate(result: CollectedResult): Promise<ValidationResult> {
        try {
            const validation = this.validateFn(result.data, result);

            // Wait for async validation if needed
            const finalValidation: ValidationResult = this.isAsync
                ? await validation
                : validation as ValidationResult;

            // Ensure metadata includes validator type
            const metadata: Record<string, unknown> = {
                ...finalValidation.metadata,
                validatorType: this.type,
            };

            return {
                ...finalValidation,
                metadata,
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [
                    error instanceof Error
                        ? error.message
                        : String(error),
                ],
                metadata: {
                    validatorType: this.type,
                },
            };
        }
    }

    /**
     * Synchronous validate method (for non-async validators)
     */
    validateSync(result: CollectedResult): ValidationResult {
        if (this.isAsync) {
            throw new Error('Cannot use validateSync with an async validator');
        }

        try {
            return this.validateFn(result.data, result) as ValidationResult;
        } catch (error) {
            return {
                isValid: false,
                errors: [
                    error instanceof Error
                        ? error.message
                        : 'Unknown validation error',
                ],
                metadata: {
                    validatorType: this.type,
                },
            };
        }
    }
}

/**
 * Factory function to create a CustomValidator
 */
export function createCustomValidator(
    name: string,
    validateFn: CustomValidationFunction,
    isAsync = false
): CustomValidator {
    return new CustomValidator({ name, validate: validateFn, async: isAsync });
}

/**
 * Helper function to create a simple synchronous validator
 */
export function createSimpleValidator(
    name: string,
    check: (data: unknown) => boolean,
    errorMessage?: string
): CustomValidator {
    return createCustomValidator(name, (data) => {
        const isValid = check(data);
        return {
            isValid,
            errors: isValid ? undefined : [errorMessage || `Validation failed for ${name}`],
        };
    });
}

/**
 * Helper function to create a validator from a predicate
 */
export function createPredicateValidator(
    name: string,
    predicate: (data: unknown) => boolean,
    errorMessage?: string
): CustomValidator {
    return createSimpleValidator(name, predicate, errorMessage);
}
