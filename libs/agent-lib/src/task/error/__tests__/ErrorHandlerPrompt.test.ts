import { describe, it, expect } from 'vitest';
import { ErrorHandlerPrompt } from '../ErrorHandlerPrompt';
import {
    ApiTimeoutError,
    ApiRequestError,
    ToolExecutionFailedError,
    MaxRetryExceededError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../../task.errors';

describe('ErrorHandlerPrompt', () => {
    describe('formatErrorPrompt', () => {
        it('should format ApiTimeoutError correctly', () => {
            const error = new ApiTimeoutError(60000);
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 0);

            expect(prompt).toContain('Error Occurred (Attempt 1)');
            expect(prompt).toContain('**Error Type:** API Timeout');
            expect(prompt).toContain('**Error Code:** API_TIMEOUT');
            expect(prompt).toContain('This error is retryable');
            expect(prompt).toContain('API request took too long');
        });

        it('should format ApiRequestError correctly', () => {
            const error = new ApiRequestError('Network error');
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 1);

            expect(prompt).toContain('Error Occurred (Attempt 2)');
            expect(prompt).toContain('**Error Type:** API Request Error');
            expect(prompt).toContain('**Error Code:** API_REQUEST_FAILED');
            expect(prompt).toContain('Network error');
            expect(prompt).toContain('This error is retryable');
        });

        it('should format ToolExecutionFailedError correctly', () => {
            const error = new ToolExecutionFailedError(
                'semantic_search',
                'Tool execution failed',
                new Error('Tool failed'),
            );
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 2);

            expect(prompt).toContain('Error Occurred (Attempt 3)');
            expect(prompt).toContain('**Error Type:** Tool Execution Failed');
            expect(prompt).toContain('**Error Code:** TOOL_EXECUTION_FAILED');
            expect(prompt).toContain('Tool execution failed');
            expect(prompt).toContain('This error is retryable');
        });

        it('should format MaxRetryExceededError correctly', () => {
            const error = new MaxRetryExceededError(3, []);
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 3);

            expect(prompt).toContain('Error Occurred (Attempt 4)');
            expect(prompt).toContain('**Error Type:** Maximum Retry Attempts Exceeded');
            expect(prompt).toContain('**Error Code:** MAX_RETRY_EXCEEDED');
            expect(prompt).toContain('This error is retryable');
        });

        it('should format NoApiResponseError correctly', () => {
            const error = new NoApiResponseError(1);
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 0);

            expect(prompt).toContain('**Error Type:** No API Response');
            expect(prompt).toContain('**Error Code:** NO_API_RESPONSE');
            expect(prompt).toContain('This error is retryable');
        });

        it('should format NoToolsUsedError correctly', () => {
            const error = new NoToolsUsedError();
            const prompt = ErrorHandlerPrompt.formatErrorPrompt(error, 0);

            expect(prompt).toContain('**Error Type:** No Tools Used');
            expect(prompt).toContain('**Error Code:** NO_TOOLS_USED');
            expect(prompt).toContain('This error is retryable');
        });
    });

    describe('formatMultipleErrorsPrompt', () => {
        it('should format multiple errors correctly', () => {
            const errors = [
                new ApiTimeoutError(60000),
                new ApiRequestError('Network error'),
                new ToolExecutionFailedError('search', 'Failed', new Error()),
            ];

            const prompt = ErrorHandlerPrompt.formatMultipleErrorsPrompt(errors);

            expect(prompt).toContain('Multiple Errors Occurred');
            expect(prompt).toContain('1. **API Timeout** (API_TIMEOUT)');
            expect(prompt).toContain('2. **API Request Error** (API_REQUEST_FAILED)');
            expect(prompt).toContain('3. **Tool Execution Failed** (TOOL_EXECUTION_FAILED)');
        });

        it('should return empty string for empty errors array', () => {
            const prompt = ErrorHandlerPrompt.formatMultipleErrorsPrompt([]);
            expect(prompt).toBe('');
        });
    });
});
