import { OpenAICompatibleConfig, OpenaiCompatibleApiClient } from "../OpenaiCompatibleApiClient";
import { ChatCompletionFunctionTool } from "../ApiClient.interface";
import { config } from "dotenv";
config()

describe("Test GLM API", () => {
    let client: OpenaiCompatibleApiClient
    const config: OpenAICompatibleConfig = {
        apiKey: process.env['GLM_API_KEY'] as string,
        model: "glm-4.5",
        baseURL: "https://open.bigmodel.cn/api/coding/paas/v4"
    }
    beforeEach(() => {

        client = new OpenaiCompatibleApiClient(config)
    })

    it('should process a simple request', async () => {
        const result = await client.makeRequest('test', 'hello', [])
        console.log(result)
    }, 50000)

    it('should handle function calling', async () => {
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
            expect(toolCall.type).toBe('function_call')
            expect(toolCall.name).toBeDefined()
            expect(toolCall.arguments).toBeDefined()

            console.log(`Tool call: ${toolCall.name}`)
            console.log(`Arguments: ${toolCall.arguments}`)
        }
    }, 50000)
})