import { AnthropicCompatibleConfig, AnthropicCompatibleApiClient } from "../AnthropicCompatibleApiClient";
import { ChatCompletionFunctionTool } from "../ApiClient.interface";
import { config } from "dotenv";
config()

describe("Test Anthropic API", () => {
    let client: AnthropicCompatibleApiClient
    const apiKey = process.env['ANTHROPIC_API_KEY']
    const hasApiKey = apiKey && apiKey.length > 0

    const apiConfig: AnthropicCompatibleConfig = {
        apiKey: apiKey || 'dummy-key-for-validation-tests',
        model: "claude-3-5-sonnet-20241022",
        baseURL: "https://api.anthropic.com/v1"
    }

    beforeEach(() => {
        client = new AnthropicCompatibleApiClient(apiConfig)
    })

    it('should process a simple request', async () => {
        if (!hasApiKey) {
            console.log('Skipping E2E test: ANTHROPIC_API_KEY not set')
            return
        }
        const result = await client.makeRequest('You are a helpful assistant.', 'Hello, how are you?', [])
        console.log('Simple request result:', result)

        expect(result).toBeDefined()
        expect(result.textResponse).toBeDefined()
        expect(result.tokenUsage).toBeDefined()
        expect(result.tokenUsage.promptTokens).toBeGreaterThan(0)
        expect(result.tokenUsage.completionTokens).toBeGreaterThan(0)
        expect(result.requestTime).toBeGreaterThan(0)
    }, 50000)

    it('should handle function calling', async () => {
        if (!hasApiKey) {
            console.log('Skipping E2E test: ANTHROPIC_API_KEY not set')
            return
        }
        const tools: ChatCompletionFunctionTool[] = [
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get the current weather for a location',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: {
                                type: 'string',
                                description: 'The city and state, e.g. San Francisco, CA',
                            },
                            unit: {
                                type: 'string',
                                enum: ['celsius', 'fahrenheit'],
                                description: 'The temperature unit',
                            },
                        },
                        required: ['location'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'calculate',
                    description: 'Perform a mathematical calculation',
                    parameters: {
                        type: 'object',
                        properties: {
                            expression: {
                                type: 'string',
                                description: 'The mathematical expression to evaluate, e.g. "2 + 2"',
                            },
                        },
                        required: ['expression'],
                    },
                },
            },
        ]

        const systemPrompt = 'You are a helpful assistant that can use tools to answer questions.'
        const workspaceContext = 'User is asking for weather and calculations.'
        const memoryContext = ['What is the weather in Beijing?']

        const result = await client.makeRequest(systemPrompt, workspaceContext, memoryContext, undefined, tools)

        console.log('Function calling result:', JSON.stringify(result, null, 2))

        // Verify tool calls were returned
        expect(result).toBeDefined()
        expect(result.toolCalls).toBeDefined()
        expect(Array.isArray(result.toolCalls)).toBe(true)

        // At least one tool call should be present
        if (result.toolCalls.length > 0) {
            const toolCall = result.toolCalls[0]
            expect(toolCall.id).toBeDefined()
            expect(toolCall.call_id).toBeDefined()
            expect(toolCall.type).toBe('function_call')
            expect(toolCall.name).toBeDefined()
            expect(toolCall.arguments).toBeDefined()

            console.log(`Tool call: ${toolCall.name}`)
            console.log(`Arguments: ${toolCall.arguments}`)
        }
    }, 50000)

    it('should handle conversation with memory context', async () => {
        if (!hasApiKey) {
            console.log('Skipping E2E test: ANTHROPIC_API_KEY not set')
            return
        }
        const systemPrompt = 'You are a helpful assistant. Remember user preferences.'
        const workspaceContext = 'User is asking about their favorite color.'
        const memoryContext = [
            'User: My favorite color is blue.',
            'Assistant: I will remember that your favorite color is blue.',
            'User: What is my favorite color?'
        ]

        const result = await client.makeRequest(systemPrompt, workspaceContext, memoryContext)

        console.log('Memory context result:', result.textResponse)

        expect(result).toBeDefined()
        expect(result.textResponse).toBeDefined()
        expect(result.textResponse.toLowerCase()).toContain('blue')
    }, 50000)

    it('should validate configuration', () => {
        // Missing API key
        expect(() => {
            new AnthropicCompatibleApiClient({
                apiKey: '',
                model: 'claude-3-5-sonnet-20241022'
            })
        }).toThrow('API key is required')

        // Missing model
        expect(() => {
            new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: ''
            })
        }).toThrow('Model name is required')

        // Invalid temperature
        expect(() => {
            new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                temperature: 1.5
            })
        }).toThrow('Temperature must be between 0 and 1')

        // Invalid maxTokens
        expect(() => {
            new AnthropicCompatibleApiClient({
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022',
                maxTokens: 0
            })
        }).toThrow('Max tokens must be greater than 0')
    })

    it('should get client stats', () => {
        const stats = client.getStats()
        expect(stats).toBeDefined()
        expect(stats.requestCount).toBe(0)
        expect(stats.lastError).toBeNull()
    })
})
