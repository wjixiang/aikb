import { AnthropicCompatibleApiClient, AnthropicCompatibleConfig } from '../AnthropicCompatibleApiClient';
import { ConfigurationError } from '../errors';
import { ChatCompletionTool } from '../ApiClient.interface';

describe('AnthropicCompatibleApiClient - Configuration', () => {
    describe('validateConfig', () => {
        it('should throw when apiKey is empty', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: '', model: 'claude-3-5-sonnet-20241022' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when apiKey is only whitespace', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: '   ', model: 'claude-3-5-sonnet-20241022' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when model is empty', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: 'test-key', model: '' });
            }).toThrow(ConfigurationError);
        });

        it('should throw when model is only whitespace', () => {
            expect(() => {
                new AnthropicCompatibleApiClient({ apiKey: 'test-key', model: '   ' });
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

        it('should allow custom maxRetries', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                maxRetries: 5,
            });
            expect((client as any).config.maxRetries).toBe(5);
        });

        it('should allow custom retryDelay', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                retryDelay: 2000,
            });
            expect((client as any).config.retryDelay).toBe(2000);
        });

        it('should allow disabling logging', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                enableLogging: false,
            });
            expect((client as any).config.enableLogging).toBe(false);
        });

        it('should allow custom baseURL', () => {
            const client = new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                baseURL: 'https://custom.endpoint.com/v1',
            });
            expect((client as any).config.baseURL).toBe('https://custom.endpoint.com/v1');
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

describe('AnthropicCompatibleApiClient - Message Building', () => {
    it('should build messages with empty context - adds workspace wrapper', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const messages = (client as any).buildMessages('', []);
        // Always wraps empty context in a user message
        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
    });

    it('should build messages with workspace context only', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const messages = (client as any).buildMessages('current file: test.ts', []);
        expect(messages.length).toBe(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toContain('current file: test.ts');
    });

    it('should build messages with memory context', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const memoryContext = ['user: hello', 'assistant: hi there'];
        const messages = (client as any).buildMessages('workspace info', memoryContext);
        // workspace + 2 memory items (all treated as user role)
        expect(messages.length).toBe(3);
        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('user');
        expect(messages[2].role).toBe('user'); // Anthropic treats all as user
    });
});

describe('AnthropicCompatibleApiClient - Tool Conversion', () => {
    it('should return undefined for empty tools array', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const result = (client as any).convertToolsToAnthropicFormat([]);
        expect(result).toBeUndefined();
    });

    it('should return undefined for undefined tools', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const result = (client as any).convertToolsToAnthropicFormat(undefined);
        expect(result).toBeUndefined();
    });

    it('should convert function tools', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const tools: ChatCompletionTool[] = [
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get weather',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City name' },
                        },
                        required: ['location'],
                    },
                },
            },
        ];
        const result = (client as any).convertToolsToAnthropicFormat(tools);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('get_weather');
        expect(result[0].description).toBe('Get weather');
        expect(result[0].input_schema.properties.location.description).toBe('City name');
    });

    it('should skip custom tools (not supported)', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const tools: ChatCompletionTool[] = [
            {
                type: 'custom',
                custom: { name: 'custom_tool' },
            } as any,
        ];
        const result = (client as any).convertToolsToAnthropicFormat(tools);
        expect(result.length).toBe(0);
    });
});

describe('AnthropicCompatibleApiClient - Retry Logic', () => {
    it('should calculate exponential backoff delay with jitter', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
            retryDelay: 1000,
        });
        // First retry: 1000 * 2^0 = 1000 (with jitter added, typically 0-50%)
        const delay1 = (client as any).calculateRetryDelay(1);
        expect(delay1).toBeGreaterThanOrEqual(1000);
        expect(delay1).toBeLessThanOrEqual(1600);

        // Second retry: 1000 * 2^1 = 2000 (with jitter added)
        const delay2 = (client as any).calculateRetryDelay(2);
        expect(delay2).toBeGreaterThanOrEqual(2000);
        expect(delay2).toBeLessThanOrEqual(3200);

        // Third retry: 1000 * 2^2 = 4000 (with jitter added)
        const delay3 = (client as any).calculateRetryDelay(3);
        expect(delay3).toBeGreaterThanOrEqual(4000);
        expect(delay3).toBeLessThanOrEqual(6400);
    });

    it('should cap delay at 30 seconds', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
            retryDelay: 10000,
        });
        // 10000 * 2^2 = 40000, should be capped at 30000
        expect((client as any).calculateRetryDelay(3)).toBe(30000);
    });

    it('should add jitter to delay', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
            retryDelay: 1000,
        });
        const delays = new Set<number>();
        for (let i = 0; i < 10; i++) {
            delays.add((client as any).calculateRetryDelay(1));
        }
        // With jitter, we should see some variation
        expect(delays.size).toBeGreaterThan(1);
    });

    it('should sleep for calculated delay', async () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        const start = Date.now();
        await (client as any).sleep(100);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(90);
        expect(elapsed).toBeLessThan(200);
    });
});

describe('AnthropicCompatibleApiClient - Input Validation', () => {
    it('should validate request inputs', () => {
        const client = new AnthropicCompatibleApiClient({
            apiKey: 'test-key',
            model: 'claude-3-5-sonnet-20241022',
        });
        expect(() => {
            (client as any).validateRequestInputs('', '', [], undefined);
        }).not.toThrow();
    });
});
