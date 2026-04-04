import {
    ApiClientError,
    AuthenticationError,
    RateLimitError,
    TimeoutError,
    NetworkError,
    ValidationError,
    ServiceUnavailableError,
    QuotaExceededError,
    ContentPolicyError,
    ResponseParsingError,
    ConfigurationError,
    UnknownApiError,
    parseError,
    isRetryableError,
    getErrorMessageWithSuggestions,
} from '../errors/errors.js';

describe('Error Types', () => {
    describe('ApiClientError', () => {
        it('should create error with all properties', () => {
            const error = new ApiClientError('test message', 'TEST_CODE', 500, true, ['suggestion 1']);
            expect(error.message).toBe('test message');
            expect(error.code).toBe('TEST_CODE');
            expect(error.statusCode).toBe(500);
            expect(error.retryable).toBe(true);
            expect(error.recoverySuggestions).toEqual(['suggestion 1']);
            expect(error.name).toBe('ApiClientError');
        });

        it('should serialize to JSON correctly', () => {
            const error = new ApiClientError('test', 'CODE', 404, false, ['fix it']);
            const json = error.toJSON();
            expect(json.name).toBe('ApiClientError');
            expect(json.message).toBe('test');
            expect(json.code).toBe('CODE');
            expect(json.statusCode).toBe(404);
            expect(json.retryable).toBe(false);
            expect(json.recoverySuggestions).toEqual(['fix it']);
        });

        it('should default retryable to false', () => {
            const error = new ApiClientError('test', 'CODE');
            expect(error.retryable).toBe(false);
        });
    });

    describe('AuthenticationError', () => {
        it('should have correct code and retryable=false', () => {
            const error = new AuthenticationError('Invalid API key', 401);
            expect(error.code).toBe('AUTHENTICATION_ERROR');
            expect(error.retryable).toBe(false);
            expect(error.statusCode).toBe(401);
            expect(error.recoverySuggestions?.length).toBeGreaterThan(0);
        });

        it('should default statusCode to undefined', () => {
            const error = new AuthenticationError('No key');
            expect(error.statusCode).toBeUndefined();
        });
    });

    describe('RateLimitError', () => {
        it('should be retryable', () => {
            const error = new RateLimitError('Rate limited', 60, 429);
            expect(error.retryable).toBe(true);
            expect(error.code).toBe('RATE_LIMIT_ERROR');
            expect(error.retryAfter).toBe(60);
            expect(error.statusCode).toBe(429);
        });

        it('should include retryAfter in suggestions', () => {
            const error = new RateLimitError('Rate limited', 120);
            expect(error.recoverySuggestions?.[0]).toContain('120 seconds');
        });

        it('should default statusCode to 429', () => {
            const error = new RateLimitError('Rate limited');
            expect(error.statusCode).toBe(429);
        });
    });

    describe('TimeoutError', () => {
        it('should be retryable with timeout info', () => {
            const error = new TimeoutError('Request timed out', 30000);
            expect(error.retryable).toBe(true);
            expect(error.timeoutMs).toBe(30000);
            expect(error.recoverySuggestions?.[0]).toContain('30000ms');
        });
    });

    describe('NetworkError', () => {
        it('should be retryable', () => {
            const error = new NetworkError('Connection refused');
            expect(error.retryable).toBe(true);
            expect(error.code).toBe('NETWORK_ERROR');
        });

        it('should preserve cause', () => {
            const cause = new Error('ECONNREFUSED');
            const error = new NetworkError('Connection refused', cause);
            expect(error.getCause()).toBe(cause);
        });
    });

    describe('ValidationError', () => {
        it('should not be retryable', () => {
            const error = new ValidationError('Invalid param', 'email');
            expect(error.retryable).toBe(false);
            expect(error.field).toBe('email');
            expect(error.statusCode).toBe(400);
        });
    });

    describe('ServiceUnavailableError', () => {
        it('should be retryable', () => {
            const error = new ServiceUnavailableError('Service down', 503);
            expect(error.retryable).toBe(true);
            expect(error.statusCode).toBe(503);
        });

        it('should default to 503', () => {
            const error = new ServiceUnavailableError('Service down');
            expect(error.statusCode).toBe(503);
        });
    });

    describe('QuotaExceededError', () => {
        it('should not be retryable', () => {
            const error = new QuotaExceededError('Monthly quota exceeded', 'monthly');
            expect(error.retryable).toBe(false);
            expect(error.quotaType).toBe('monthly');
        });
    });

    describe('ContentPolicyError', () => {
        it('should not be retryable', () => {
            const error = new ContentPolicyError('Content violates policy');
            expect(error.retryable).toBe(false);
            expect(error.code).toBe('CONTENT_POLICY_VIOLATION');
        });
    });

    describe('ResponseParsingError', () => {
        it('should preserve raw response', () => {
            const raw = { unexpected: 'structure' };
            const error = new ResponseParsingError('Cannot parse', raw);
            expect(error.rawResponse).toBe(raw);
        });
    });

    describe('ConfigurationError', () => {
        it('should indicate config field', () => {
            const error = new ConfigurationError('Missing apiKey', 'apiKey');
            expect(error.configField).toBe('apiKey');
            expect(error.recoverySuggestions?.[0]).toContain('apiKey');
        });
    });

    describe('UnknownApiError', () => {
        it('should preserve original error', () => {
            const original = { reason: 'unknown' };
            const error = new UnknownApiError('Something went wrong', original);
            expect(error.originalError).toBe(original);
        });
    });
});

describe('parseError', () => {
    it('should return ApiClientError as-is', () => {
        const original = new ApiClientError('already parsed', 'CODE');
        const result = parseError(original);
        expect(result).toBe(original);
    });

    it('should parse timeout errors', () => {
        const error = new Error('Request timed out after 30s');
        const result = parseError(error);
        expect(result).toBeInstanceOf(TimeoutError);
    });

    it('should parse timeout with timeout keyword', () => {
        const error = new Error('timeout exceeded');
        const result = parseError(error, { timeout: 5000 });
        expect(result).toBeInstanceOf(TimeoutError);
        expect((result as TimeoutError).timeoutMs).toBe(5000);
    });

    it('should parse ECONNREFUSED as NetworkError', () => {
        const error = new Error('ECONNREFUSED: Connection refused');
        const result = parseError(error);
        expect(result).toBeInstanceOf(NetworkError);
        expect(result.retryable).toBe(true);
    });

    it('should parse ENOTFOUND as NetworkError', () => {
        const error = new Error('ENOTFOUND: Host not found');
        const result = parseError(error);
        expect(result).toBeInstanceOf(NetworkError);
    });

    it('should parse ECONNRESET as NetworkError', () => {
        const error = new Error('ECONNRESET: Connection reset');
        const result = parseError(error);
        expect(result).toBeInstanceOf(NetworkError);
    });

    it('should parse ETIMEDOUT as TimeoutError (timeout check takes priority)', () => {
        const error = new Error('ETIMEDOUT: Connection timed out');
        const result = parseError(error);
        expect(result).toBeInstanceOf(TimeoutError);
    });

    it('should parse fetch failed as NetworkError', () => {
        const error = new Error('fetch failed');
        const result = parseError(error);
        expect(result).toBeInstanceOf(NetworkError);
    });

    it('should parse 401 as AuthenticationError', () => {
        const error = new Error('401 Unauthorized');
        const result = parseError(error);
        expect(result).toBeInstanceOf(AuthenticationError);
    });

    it('should parse invalid api key as AuthenticationError', () => {
        const error = new Error('invalid api key provided');
        const result = parseError(error);
        expect(result).toBeInstanceOf(AuthenticationError);
    });

    it('should parse 429 as RateLimitError', () => {
        const error = new Error('429 Too Many Requests');
        const result = parseError(error);
        expect(result).toBeInstanceOf(RateLimitError);
    });

    it('should parse rate limit message - checks quota before rate limit', () => {
        const error = new Error('Rate limit exceeded, please slow down');
        const result = parseError(error);
        expect(result).toBeInstanceOf(QuotaExceededError);
    });

    it('should parse 503 as ServiceUnavailableError', () => {
        const error = new Error('503 Service Unavailable');
        const result = parseError(error);
        expect(result).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should parse 502 as ServiceUnavailableError', () => {
        const error = new Error('502 Bad Gateway');
        const result = parseError(error);
        expect(result).toBeInstanceOf(ServiceUnavailableError);
    });

    it('should parse quota errors', () => {
        const error = new Error('Quota exceeded for this month');
        const result = parseError(error);
        expect(result).toBeInstanceOf(QuotaExceededError);
    });

    it('should parse content policy violations with exact keywords', () => {
        const error1 = new Error('content policy violation detected');
        expect(parseError(error1)).toBeInstanceOf(ContentPolicyError);

        const error2 = new Error('safety filter triggered');
        expect(parseError(error2)).toBeInstanceOf(ContentPolicyError);

        const error3 = new Error('content moderation failed');
        expect(parseError(error3)).toBeInstanceOf(ContentPolicyError);
    });

    it('should parse validation errors', () => {
        const error = new Error('400 Bad Request: validation failed');
        const result = parseError(error);
        expect(result).toBeInstanceOf(ValidationError);
    });

    it('should parse object with status property', () => {
        const error = { status: 401, message: 'Unauthorized' };
        const result = parseError(error);
        expect(result).toBeInstanceOf(AuthenticationError);
    });

    it('should parse object with status 429', () => {
        const error = { status: 429, message: 'Rate limit' };
        const result = parseError(error);
        expect(result).toBeInstanceOf(RateLimitError);
    });

    it('should parse object with content_policy code', () => {
        const error = { status: 400, code: 'content_policy', message: 'violation' };
        const result = parseError(error);
        expect(result).toBeInstanceOf(ContentPolicyError);
    });

    it('should return UnknownApiError for unrecognized errors', () => {
        const error = new Error('Something completely unexpected');
        const result = parseError(error);
        expect(result).toBeInstanceOf(UnknownApiError);
    });

    it('should return UnknownApiError for non-object errors', () => {
        const result = parseError(null);
        expect(result).toBeInstanceOf(UnknownApiError);
    });

    it('should return UnknownApiError for string errors', () => {
        const result = parseError('error string');
        expect(result).toBeInstanceOf(UnknownApiError);
    });
});

describe('isRetryableError', () => {
    it('should return true for RateLimitError', () => {
        expect(isRetryableError(new RateLimitError('rate limited'))).toBe(true);
    });

    it('should return true for NetworkError', () => {
        expect(isRetryableError(new NetworkError('no connection'))).toBe(true);
    });

    it('should return true for TimeoutError', () => {
        expect(isRetryableError(new TimeoutError('timed out', 30000))).toBe(true);
    });

    it('should return true for ServiceUnavailableError', () => {
        expect(isRetryableError(new ServiceUnavailableError('down'))).toBe(true);
    });

    it('should return false for AuthenticationError', () => {
        expect(isRetryableError(new AuthenticationError('bad key'))).toBe(false);
    });

    it('should return false for ValidationError', () => {
        expect(isRetryableError(new ValidationError('invalid'))).toBe(false);
    });

    it('should return false for QuotaExceededError', () => {
        expect(isRetryableError(new QuotaExceededError('quota'))).toBe(false);
    });

    it('should return false for ContentPolicyError', () => {
        expect(isRetryableError(new ContentPolicyError('violated'))).toBe(false);
    });

    it('should parse and check retryable for plain errors', () => {
        expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
        expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    });
});

describe('getErrorMessageWithSuggestions', () => {
    it('should include recovery suggestions', () => {
        const msg = getErrorMessageWithSuggestions(new RateLimitError('Slow down', 30));
        expect(msg).toContain('Error: Slow down');
        expect(msg).toContain('Suggestions');
        expect(msg).toContain('30 seconds');
    });

    it('should handle errors without suggestions', () => {
        const error = new ApiClientError('basic error', 'BASIC');
        const msg = getErrorMessageWithSuggestions(error);
        expect(msg).toContain('basic error');
        expect(msg).not.toContain('Suggestions');
    });

    it('should format suggestions as numbered list', () => {
        const error = new AuthenticationError('bad key');
        const msg = getErrorMessageWithSuggestions(error);
        expect(msg).toContain('1.');
        expect(msg).toContain('2.');
    });
});
