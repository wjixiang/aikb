import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  DatabaseError,
  StorageError,
  BadRequestError,
  RateLimitError,
} from '../AppError.js';

describe('AppError', () => {
  it('should create a basic AppError with default values', () => {
    const error = new AppError('Something went wrong');

    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should create an AppError with custom values', () => {
    const error = new AppError('Custom error', 400, 'CUSTOM_ERROR', false);

    expect(error.message).toBe('Custom error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('CUSTOM_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('should convert to JSON correctly', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR');
    const json = error.toJSON();

    expect(json).toEqual({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
        statusCode: 400,
      },
    });
  });
});

describe('ValidationError', () => {
  it('should create a ValidationError with default message', () => {
    const error = new ValidationError();

    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([]);
  });

  it('should create a ValidationError with details', () => {
    const details = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Password too short' },
    ];
    const error = new ValidationError('Request validation failed', details);

    expect(error.message).toBe('Request validation failed');
    expect(error.details).toEqual(details);
  });

  it('should include details in JSON output', () => {
    const details = [{ field: 'name', message: 'Name is required' }];
    const error = new ValidationError('Validation failed', details);
    const json = error.toJSON();

    expect(json.error.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('should create a NotFoundError with just resource type', () => {
    const error = new NotFoundError('User');

    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should create a NotFoundError with resource type and identifier', () => {
    const error = new NotFoundError('Message', 'msg_123');

    expect(error.message).toBe('Message not found: msg_123');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('should create a ConflictError with default message', () => {
    const error = new ConflictError();

    expect(error.message).toBe('Conflict with current state');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should create a ConflictError with custom message', () => {
    const error = new ConflictError('Email already exists');

    expect(error.message).toBe('Email already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });
});

describe('UnauthorizedError', () => {
  it('should create an UnauthorizedError with default message', () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should create an UnauthorizedError with custom message', () => {
    const error = new UnauthorizedError('Invalid credentials');

    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });
});

describe('ForbiddenError', () => {
  it('should create a ForbiddenError with default message', () => {
    const error = new ForbiddenError();

    expect(error.message).toBe('Forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create a ForbiddenError with custom message', () => {
    const error = new ForbiddenError('Insufficient permissions');

    expect(error.message).toBe('Insufficient permissions');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });
});

describe('DatabaseError', () => {
  it('should create a DatabaseError with default message', () => {
    const error = new DatabaseError();

    expect(error.message).toBe('Database operation failed');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.isOperational).toBe(false);
    expect(error.originalError).toBeUndefined();
  });

  it('should create a DatabaseError with original error', () => {
    const originalError = new Error('Connection timeout');
    const error = new DatabaseError('Query failed', originalError);

    expect(error.message).toBe('Query failed');
    expect(error.originalError).toBe(originalError);
    expect(error.isOperational).toBe(false);
  });
});

describe('StorageError', () => {
  it('should create a StorageError with default message', () => {
    const error = new StorageError();

    expect(error.message).toBe('Storage operation failed');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('STORAGE_ERROR');
    expect(error.isOperational).toBe(false);
    expect(error.originalError).toBeUndefined();
  });

  it('should create a StorageError with original error', () => {
    const originalError = new Error('Disk full');
    const error = new StorageError('Write failed', originalError);

    expect(error.message).toBe('Write failed');
    expect(error.originalError).toBe(originalError);
    expect(error.isOperational).toBe(false);
  });
});

describe('BadRequestError', () => {
  it('should create a BadRequestError with default message', () => {
    const error = new BadRequestError();

    expect(error.message).toBe('Bad request');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });

  it('should create a BadRequestError with custom message', () => {
    const error = new BadRequestError('Malformed JSON');

    expect(error.message).toBe('Malformed JSON');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
  });
});

describe('RateLimitError', () => {
  it('should create a RateLimitError with default message', () => {
    const error = new RateLimitError();

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.retryAfter).toBeUndefined();
  });

  it('should create a RateLimitError with retryAfter', () => {
    const error = new RateLimitError('Too many requests', 60);

    expect(error.message).toBe('Too many requests');
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.retryAfter).toBe(60);
  });

  it('should include retryAfter in JSON output', () => {
    const error = new RateLimitError('Rate limit exceeded', 30);
    const json = error.toJSON();

    expect(json.error.retryAfter).toBe(30);
  });
});
