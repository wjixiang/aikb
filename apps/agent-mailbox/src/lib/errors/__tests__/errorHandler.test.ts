import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';
import {
  handleError,
  convertZodError,
  type ErrorResponse,
} from '../errorHandler.js';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../AppError.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock Fastify request and reply
const createMockRequest = (): Partial<FastifyRequest> => ({
  url: '/api/v1/mail/send',
  method: 'POST',
  body: {},
  params: {},
  query: {},
  log: {
    error: vi.fn(),
  } as unknown as FastifyRequest['log'],
});

const createMockReply = (): Partial<FastifyReply> => {
  const statusCode = { value: 200 };
  const sent = { value: null as ErrorResponse | null };

  return {
    status: vi.fn((code: number) => {
      statusCode.value = code;
      return mockReply as FastifyReply;
    }),
    send: vi.fn((data: ErrorResponse) => {
      sent.value = data;
      return mockReply as FastifyReply;
    }),
    _statusCode: statusCode,
    _sent: sent,
  };
};

let mockReply = createMockReply();

describe('convertZodError', () => {
  it('should convert ZodError to ValidationError', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    try {
      schema.parse({ email: 'invalid', age: 16 });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = convertZodError(error);

        expect(validationError).toBeInstanceOf(ValidationError);
        expect(validationError.message).toBe('Request validation failed');
        expect(validationError.details).toHaveLength(2);
        expect(validationError.details[0]).toHaveProperty('field');
        expect(validationError.details[0]).toHaveProperty('message');
      }
    }
  });
});

describe('handleError', () => {
  beforeEach(() => {
    mockReply = createMockReply();
  });

  it('should handle AppError correctly', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new NotFoundError('Message', '123');

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('Message not found: 123');
    expect(result.error.statusCode).toBe(404);
  });

  it('should handle ValidationError with details', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const details = [{ field: 'email', message: 'Invalid email' }];
    const error = new ValidationError('Validation failed', details);

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(400);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.details).toEqual(details);
  });

  it('should handle ZodError', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const schema = z.object({ name: z.string().min(1) });

    try {
      schema.parse({ name: '' });
    } catch (error) {
      if (error instanceof ZodError) {
        const result = handleError(error, request, reply);

        expect(mockReply.status).toHaveBeenCalledWith(400);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.details).toBeDefined();
        expect(result.error.details).toHaveLength(1);
      }
    }
  });

  it('should handle generic Error', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Something went wrong');

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(500);
    expect(result.error.code).toBe('INTERNAL_ERROR');
    expect(result.error.message).toBe('Internal server error');
  });

  it('should handle Prisma unique constraint error', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Unique constraint violation') as Error & { code: string; meta?: Record<string, unknown> };
    error.code = 'P2002';
    error.meta = { target: 'email' };

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(409);
    expect(result.error.code).toBe('DUPLICATE_ENTRY');
  });

  it('should handle Prisma record not found error', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Record not found') as Error & { code: string };
    error.code = 'P2025';

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(404);
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('should handle Prisma foreign key error', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Foreign key constraint') as Error & { code: string; meta?: Record<string, unknown> };
    error.code = 'P2003';
    error.meta = { field_name: 'userId' };

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(409);
    expect(result.error.code).toBe('FOREIGN_KEY_VIOLATION');
  });

  it('should handle Prisma database unavailable error', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Database unavailable') as Error & { code: string };
    error.code = 'P1001';

    const result = handleError(error, request, reply);

    expect(mockReply.status).toHaveBeenCalledWith(503);
    expect(result.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('should include error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Detailed error');

    const result = handleError(error, request, reply);

    expect(result.error.details).toBeDefined();
    expect(result.error.details).toHaveProperty('message', 'Detailed error');
    expect(result.error.details).toHaveProperty('stack');

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Detailed error');

    const result = handleError(error, request, reply);

    expect(result.error.details).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should log error for debugging', () => {
    const request = createMockRequest() as FastifyRequest;
    const reply = mockReply as unknown as FastifyReply;
    const error = new Error('Test error');

    handleError(error, request, reply);

    expect(request.log.error).toHaveBeenCalled();
  });
});
