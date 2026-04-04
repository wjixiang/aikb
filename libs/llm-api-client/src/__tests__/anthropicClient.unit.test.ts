import { AnthropicCompatibleApiClient } from '../client/anthropic.js';
import { ConfigurationError } from '../errors/errors.js';

describe('AnthropicCompatibleApiClient - Configuration', () => {
    describe('validateConfig', () => {
        it('should throw when apiKey is empty', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: '', model: 'claude-3-5-sonnet-20241022' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when model is empty', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: 'test-key', model: '' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when temperature is negative', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    temperature: -0.1,
                });
            }).toThrow(ConfigurationError);
        });

        it('should throw when temperature is greater than 1', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    temperature: 1.5,
                });
            }).toThrow(ConfigurationError);
        });

        it('should accept temperature at boundaries (0 and 1)', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    temperature: 0,
                });
            }).not.toThrow();

            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    temperature: 1,
                });
            }).not.toThrow();
        });

        it('should throw when maxTokens is 0', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    maxTokens: 0,
                });
            }).toThrow(ConfigurationError);
        });

        it('should throw when maxTokens is negative', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                    maxTokens: -1,
                });
            }).toThrow(ConfigurationError);
        });

        it('should accept valid configuration', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'claude-3-5-sonnet-20241022',
                });
            }).not.toThrow();
        });

        it('should apply default values', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
            });
            expect((client as any).config.maxRetries).toBe(3);
            expect((client as any).config.retryDelay).toBe(1000);
            expect((client as any).config.enableLogging).toBe(true);
        });

        it('should allow custom baseURL', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                baseURL: 'https://custom.anthropic.com/v1',
            });
            expect((client as any).config.baseURL).toBe('https://custom.anthropic.com/v1');
        });
    });
});

describe('AnthropicCompatibleApiClient - getStats', () => {
    it('should return initial stats', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const stats = client.getStats();
        expect(stats.requestCount).toBe(0);
        expect(stats.lastError).toBeNull();
    });
});
