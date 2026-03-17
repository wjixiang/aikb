import {
  ValidationPipe as NestValidationPipe,
  ValidationError,
  BadRequestException,
} from '@nestjs/common';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

export class ValidationException extends BadRequestException {
  constructor(public readonly errors: ValidationErrorDetail[]) {
    super({
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: errors,
    });
  }
}

export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = formatValidationErrors(errors);
        return new ValidationException(formattedErrors);
      },
    });
  }
}

function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  const result: ValidationErrorDetail[] = [];

  for (const error of errors) {
    const currentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const [constraint, message] of Object.entries(error.constraints)) {
        result.push({
          field: currentPath,
          message,
          value: error.value,
        });
      }
    }

    if (error.children && error.children.length > 0) {
      result.push(...formatValidationErrors(error.children, currentPath));
    }
  }

  return result;
}

// Custom validation decorators helpers
export const validationMessages = {
  isString: (field: string) => `${field} must be a string`,
  isNumber: (field: string) => `${field} must be a number`,
  isBoolean: (field: string) => `${field} must be a boolean`,
  isDate: (field: string) => `${field} must be a valid date`,
  isEmail: (field: string) => `${field} must be a valid email address`,
  isUUID: (field: string) => `${field} must be a valid UUID`,
  isNotEmpty: (field: string) => `${field} should not be empty`,
  minLength: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) =>
    `${field} must not exceed ${max} characters`,
  min: (field: string, min: number) => `${field} must be at least ${min}`,
  max: (field: string, max: number) => `${field} must not exceed ${max}`,
  isEnum: (field: string, values: string[]) =>
    `${field} must be one of: ${values.join(', ')}`,
  isArray: (field: string) => `${field} must be an array`,
  arrayMinSize: (field: string, min: number) =>
    `${field} must contain at least ${min} items`,
  arrayMaxSize: (field: string, max: number) =>
    `${field} must not contain more than ${max} items`,
  matches: (field: string, pattern: string) =>
    `${field} must match the pattern: ${pattern}`,
  isUrl: (field: string) => `${field} must be a valid URL`,
  isJson: (field: string) => `${field} must be a valid JSON`,
};
