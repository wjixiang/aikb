import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: this.extractMessage(exceptionResponse),
      error: this.extractErrorName(exceptionResponse, status),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add validation details if available
    if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
      const messages = exceptionResponse['message'];
      if (Array.isArray(messages) && messages.length > 1) {
        errorResponse.details = { messages };
      }
    }

    // Log error
    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${errorResponse.message}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }

  private extractMessage(response: string | object): string {
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && response !== null) {
      if ('message' in response) {
        const message = response['message'];
        return Array.isArray(message) ? message[0] : String(message);
      }
      return 'An error occurred';
    }
    return 'Internal server error';
  }

  private extractErrorName(response: string | object, status: number): string {
    if (typeof response === 'object' && response !== null && 'error' in response) {
      return String(response['error']);
    }
    return HttpStatus[status] || 'Error';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }
}
