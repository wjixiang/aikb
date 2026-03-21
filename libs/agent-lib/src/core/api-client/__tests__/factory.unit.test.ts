import { ApiClientFactory } from '../ApiClientFactory';
import { AnthropicCompatibleApiClient } from '../AnthropicCompatibleApiClient';
import { OpenaiCompatibleApiClient } from '../OpenaiCompatibleApiClient';
import { ProviderSettings } from '../../types/provider-settings';

describe('ApiClientFactory', () => {
    describe('create', () => {
        it('should throw when apiKey is missing', () => {
            const config = { apiProvider: 'openai', apiModelId: 'gpt-4' } as ProviderSettings;
            expect(() => ApiClientFactory.create(config)).toThrow('API key is required');
        });

        it('should throw when modelId is missing', () => {
            const config = { apiProvider: 'openai', apiKey: 'test-key' } as ProviderSettings;
            expect(() => ApiClientFactory.create(config)).toThrow('Model ID is required');
        });

        it('should create OpenaiCompatibleApiClient for openai provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should create OpenaiCompatibleApiClient for openai-native provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai-native',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should create AnthropicCompatibleApiClient for anthropic provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'anthropic',
                apiKey: 'test-key',
                apiModelId: 'claude-3-5-sonnet-20241022',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(AnthropicCompatibleApiClient);
        });

        it('should use default Anthropic baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'anthropic',
                apiKey: 'test-key',
                apiModelId: 'claude-3-5-sonnet-20241022',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://api.anthropic.com/v1');
        });

        it('should use custom Anthropic baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'anthropic',
                apiKey: 'test-key',
                apiModelId: 'claude-3-5-sonnet-20241022',
                anthropicBaseUrl: 'https://custom.anthropic.com/v1',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://custom.anthropic.com/v1');
        });

        it('should use default OpenAI baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://api.openai.com/v1');
        });

        it('should use custom OpenAI baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
                openAiBaseUrl: 'https://custom.openai.com/v1',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://custom.openai.com/v1');
        });

        it('should create OpenaiCompatibleApiClient for ollama provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'ollama',
                apiKey: 'test-key',
                apiModelId: 'llama2',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should use default ollama baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'ollama',
                apiKey: 'test-key',
                apiModelId: 'llama2',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('http://localhost:11434/v1');
        });

        it('should create OpenaiCompatibleApiClient for lmstudio provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'lmstudio',
                apiKey: 'test-key',
                apiModelId: 'model',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should use default lmstudio baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'lmstudio',
                apiKey: 'test-key',
                apiModelId: 'model',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('http://localhost:1234/v1');
        });

        it('should create ZAI client with china_coding endpoint', () => {
            const config: ProviderSettings = {
                apiProvider: 'zai',
                apiKey: 'test-key',
                apiModelId: 'glm-4',
                zaiApiLine: 'china_coding',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
        });

        it('should create ZAI client with international_coding endpoint', () => {
            const config: ProviderSettings = {
                apiProvider: 'zai',
                apiKey: 'test-key',
                apiModelId: 'glm-4',
                zaiApiLine: 'international_coding',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://open.bigmodel.cn/api/paas/v4');
        });

        it('should use default ZAI line as china_coding', () => {
            const config: ProviderSettings = {
                apiProvider: 'zai',
                apiKey: 'test-key',
                apiModelId: 'glm-4',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
        });

        it('should create Moonshot client with coding endpoint', () => {
            const config: ProviderSettings = {
                apiProvider: 'moonshot',
                apiKey: 'test-key',
                apiModelId: 'kimi-for-coding',
                moonshotApiLine: 'coding',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://api.kimi.com/coding/');
        });

        it('should create Moonshot client with standard endpoint', () => {
            const config: ProviderSettings = {
                apiProvider: 'moonshot',
                apiKey: 'test-key',
                apiModelId: 'kimi',
                moonshotApiLine: 'standard',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://api.moonshot.cn/v1');
        });

        it('should use custom moonshot baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'moonshot',
                apiKey: 'test-key',
                apiModelId: 'kimi',
                moonshotBaseUrl: 'https://custom.moonshot.cn/v1',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://custom.moonshot.cn/v1');
        });

        it('should create MiniMax client', () => {
            const config: ProviderSettings = {
                apiProvider: 'minimax',
                apiKey: 'test-key',
                apiModelId: 'abab5.5-chat',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should use default MiniMax baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'minimax',
                apiKey: 'test-key',
                apiModelId: 'abab5.5-chat',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://api.minimax.chat/v1');
        });

        it('should use custom MiniMax baseURL', () => {
            const config: ProviderSettings = {
                apiProvider: 'minimax',
                apiKey: 'test-key',
                apiModelId: 'abab5.5-chat',
                minimaxBaseUrl: 'https://custom.minimax.chat/v1',
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.baseURL).toBe('https://custom.minimax.chat/v1');
        });

        it('should default to OpenaiCompatibleApiClient for unknown provider', () => {
            const config: ProviderSettings = {
                apiProvider: 'unknown' as any,
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
            };
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });

        it('should pass modelTemperature to client', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
                modelTemperature: 0.7,
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.temperature).toBe(0.7);
        });

        it('should pass modelMaxTokens to client', () => {
            const config: ProviderSettings = {
                apiProvider: 'openai',
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
                modelMaxTokens: 1000,
            };
            const client = ApiClientFactory.create(config) as any;
            expect(client.config.maxTokens).toBe(1000);
        });

        it('should default provider to openai', () => {
            const config: ProviderSettings = {
                apiKey: 'test-key',
                apiModelId: 'gpt-4',
            } as any;
            const client = ApiClientFactory.create(config);
            expect(client).toBeInstanceOf(OpenaiCompatibleApiClient);
        });
    });
});
