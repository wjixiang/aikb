import { OpenaiCompatibleApiClient } from '../OpenaiCompatibleApiClient.js';
import { ConfigurationError } from '../errors.js';

describe('OpenaiCompatibleApiClient - Configuration', () => {
    describe('validateConfig', () => {
        it('should throw when apiKey is empty', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({ apiKey: '', model: 'gpt-4' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when apiKey is only whitespace', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({ apiKey: '   ', model: 'gpt-4' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when model is empty', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({ apiKey: 'test-key', model: '' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when model is only whitespace', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({ apiKey: 'test-key', model: '   ' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when temperature is negative', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    temperature: -0.1,
                });
            }).toThrow(ConfigurationError);
        });

        it('should throw when temperature is greater than 2', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    temperature: 2.5,
                });
            }).toThrow(ConfigurationError);
        });

        it('should accept temperature at boundaries (0 and 2)', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    temperature: 0,
                });
            }).not.toThrow();

            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    temperature: 2,
                });
            }).not.toThrow();
        });

        it('should throw when maxTokens is 0', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    maxTokens: 0,
                });
            }).toThrow(ConfigurationError);
        });

        it('should throw when maxTokens is negative', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    maxTokens: -1,
                });
            }).toThrow(ConfigurationError);
        });

        it('should accept valid configuration', () => {
            expect(() => {
                new OpenaiCompatibleApiClient({
                    apiKey: 'test-key',
                    model: 'gpt-4',
                });
            }).not.toThrow();
        });

        it('should apply default values', () => {
            const client = new OpenaiCompatibleApiClient({
                apiKey: 'test-key',
                model: 'gpt-4',
            });
            expect((client as any).config.maxRetries).toBe(3);
            expect((client as any).config.retryDelay).toBe(1000);
            expect((client as any).config.enableLogging).toBe(true);
        });

        it('should allow custom maxRetries', () => {
            const client = new OpenaiCompatibleApiClient({
                apiKey: 'test-key',
                model: 'gpt-4',
                maxRetries: 5,
            });
            expect((client as any).config.maxRetries).toBe(5);
        });

        it('should allow custom retryDelay', () => {
            const client = new OpenaiCompatibleApiClient({
                apiKey: 'test-key',
                model: 'gpt-4',
                retryDelay: 2000,
            });
            expect((client as any).config.retryDelay).toBe(2000);
        });

        it('should allow disabling logging', () => {
            const client = new OpenaiCompatibleApiClient({
                apiKey: 'test-key',
                model: 'gpt-4',
                enableLogging: false,
            });
            expect((client as any).config.enableLogging).toBe(false);
        });

        it('should allow custom baseURL', () => {
            const client = new OpenaiCompatibleApiClient({
                apiKey: 'test-key',
                model: 'gpt-4',
                baseURL: 'https://api.example.com/v1',
            });
            expect((client as any).config.baseURL).toBe('https://api.example.com/v1');
        });
    });
});

describe('OpenaiCompatibleApiClient - getStats', () => {
    it('should return initial stats', () => {
        const client = new OpenaiCompatibleApiClient({
            apiKey: 'test-key',
            model: 'gpt-4',
        });
        const stats = client.getStats();
        expect(stats.requestCount).toBe(0);
        expect(stats.lastError).toBeNull();
    });
});

describe('OpenaiCompatibleApiClient - Retry Logic', () => {
    it('should calculate exponential backoff delay with jitter', () => {
        const client = new OpenaiCompatibleApiClient({
            apiKey: 'test-key',
            model: 'gpt-4',
            retryDelay: 1000,
        });
        const delay1 = (client as any).calculateRetryDelay(1);
        expect(delay1).toBeGreaterThanOrEqual(1000);
        expect(delay1).toBeLessThanOrEqual(1600);

        const delay2 = (client as any).calculateRetryDelay(2);
        expect(delay2).toBeGreaterThanOrEqual(2000);
        expect(delay2).toBeLessThanOrEqual(3200);

        const delay3 = (client as any).calculateRetryDelay(3);
        expect(delay3).toBeGreaterThanOrEqual(4000);
        expect(delay3).toBeLessThanOrEqual(6400);
    });

    it('should cap delay at 30 seconds', () => {
        const client = new OpenaiCompatibleApiClient({
            apiKey: 'test-key',
            model: 'gpt-4',
            retryDelay: 10000,
        });
        expect((client as any).calculateRetryDelay(3)).toBe(30000);
    });

    it('should add jitter to delay', () => {
        const client = new OpenaiCompatibleApiClient({
            apiKey: 'test-key',
            model: 'gpt-4',
            retryDelay: 1000,
        });
        const delays = new Set<number>();
        for (let i = 0; i < 10; i++) {
            delays.add((client as any).calculateRetryDelay(1));
        }
        expect(delays.size).toBeGreaterThan(1);
    });

    it('should sleep for calculated delay', async () => {
        const client = new OpenaiCompatibleApiClient({
            apiKey: 'test-key',
            model: 'gpt-4',
        });
        const start = Date.now();
        await (client as any).sleep(100);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(90);
        expect(elapsed).toBeLessThan(200);
    });
});
