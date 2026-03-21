import { z } from 'zod';
import {
    DefaultToolCallConverter,
    createOpenAIFunctionCallingParams,
    OpenAIFunctionCallingParams,
} from '../ToolCallConvert';
import { Tool } from '../../components/core/types';

describe('DefaultToolCallConverter', () => {
    const converter = new DefaultToolCallConverter();

    describe('convertTool', () => {
        it('should convert a basic tool with Zod schema', () => {
            const tool: Tool = {
                toolName: 'get_weather',
                desc: 'Get the current weather for a location',
                paramsSchema: z.object({
                    location: z.string().describe('City name'),
                    unit: z.enum(['celsius', 'fahrenheit']).optional(),
                }),
            };

            const result = converter.convertTool(tool);

            expect(result.type).toBe('function');
            expect(result.function.name).toBe('get_weather');
            expect(result.function.description).toBe('Get the current weather for a location');
            expect(result.function.parameters).toBeDefined();
            expect(result.function.parameters.type).toBe('object');
            expect(result.function.parameters.properties).toBeDefined();
            expect(result.function.parameters.properties.location).toBeDefined();
        });

        it('should append examples to description', () => {
            const tool: Tool = {
                toolName: 'search',
                desc: 'Search for information',
                paramsSchema: z.object({
                    query: z.string(),
                }),
                examples: [
                    {
                        description: 'Search for weather info',
                        params: { query: 'weather' },
                        expectedResult: 'Weather information',
                    },
                ],
            };

            const result = converter.convertTool(tool);

            expect(result.function.description).toContain('Search for information');
            expect(result.function.description).toContain('## Examples');
            expect(result.function.description).toContain('Search for weather info');
            expect(result.function.description).toContain('weather');
            expect(result.function.description).toContain('Expected:');
        });

        it('should handle tool without examples', () => {
            const tool: Tool = {
                toolName: 'simple_tool',
                desc: 'A simple tool',
                paramsSchema: z.object({
                    input: z.string(),
                }),
            };

            const result = converter.convertTool(tool);

            expect(result.function.description).toBe('A simple tool');
            expect(result.function.description).not.toContain('## Examples');
        });

        it('should handle tool with empty examples', () => {
            const tool: Tool = {
                toolName: 'tool',
                desc: 'Tool description',
                paramsSchema: z.object({
                    param: z.string(),
                }),
                examples: [],
            };

            const result = converter.convertTool(tool);

            expect(result.function.description).toBe('Tool description');
            expect(result.function.description).not.toContain('## Examples');
        });

        it('should handle nested object schema', () => {
            const tool: Tool = {
                toolName: 'complex_tool',
                desc: 'Complex tool',
                paramsSchema: z.object({
                    user: z.object({
                        name: z.string(),
                        age: z.number(),
                        address: z.object({
                            city: z.string(),
                            zip: z.string(),
                        }),
                    }),
                    tags: z.array(z.string()),
                }),
            };

            const result = converter.convertTool(tool);

            expect(result.function.parameters.properties.user).toBeDefined();
            expect(result.function.parameters.properties.user.properties.name).toBeDefined();
            expect(result.function.parameters.properties.user.properties.address).toBeDefined();
            expect(result.function.parameters.properties.tags).toBeDefined();
        });

        it('should include required fields', () => {
            const tool: Tool = {
                toolName: 'required_tool',
                desc: 'Tool with required fields',
                paramsSchema: z.object({
                    requiredField: z.string(),
                    optionalField: z.string().optional(),
                }),
            };

            const result = converter.convertTool(tool);

            expect(result.function.parameters.required).toContain('requiredField');
            expect(result.function.parameters.required).not.toContain('optionalField');
        });

        it('should handle enum parameters', () => {
            const tool: Tool = {
                toolName: 'enum_tool',
                desc: 'Tool with enum',
                paramsSchema: z.object({
                    status: z.enum(['active', 'inactive', 'pending']),
                }),
            };

            const result = converter.convertTool(tool);

            expect(result.function.parameters.properties.status.enum).toEqual(['active', 'inactive', 'pending']);
        });
    });

    describe('convertTools', () => {
        it('should convert multiple tools', () => {
            const tools: Tool[] = [
                {
                    toolName: 'tool1',
                    desc: 'First tool',
                    paramsSchema: z.object({ param1: z.string() }),
                },
                {
                    toolName: 'tool2',
                    desc: 'Second tool',
                    paramsSchema: z.object({ param2: z.number() }),
                },
            ];

            const result = converter.convertTools(tools);

            expect(result.length).toBe(2);
            expect(result[0].function.name).toBe('tool1');
            expect(result[1].function.name).toBe('tool2');
        });

        it('should return empty array for empty input', () => {
            const result = converter.convertTools([]);
            expect(result).toEqual([]);
        });
    });
});

describe('createOpenAIFunctionCallingParams', () => {
    it('should create params with all required fields', () => {
        const tools: Tool[] = [
            {
                toolName: 'test_tool',
                desc: 'Test tool',
                paramsSchema: z.object({ input: z.string() }),
            },
        ];
        const messages = [{ role: 'user' as const, content: 'Hello' }];

        const result = createOpenAIFunctionCallingParams(tools, messages, 'gpt-4');

        expect(result.model).toBe('gpt-4');
        expect(result.messages).toEqual(messages);
        expect(result.tools).toHaveLength(1);
        expect(result.tools?.[0].function.name).toBe('test_tool');
    });

    it('should include optional parameters when provided', () => {
        const tools: Tool[] = [];
        const messages = [{ role: 'user' as const, content: 'Hello' }];

        const result = createOpenAIFunctionCallingParams(tools, messages, 'gpt-4', {
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 0.9,
            frequency_penalty: 0.5,
            presence_penalty: 0.3,
            stream: false,
        });

        expect(result.temperature).toBe(0.7);
        expect(result.max_tokens).toBe(1000);
        expect(result.top_p).toBe(0.9);
        expect(result.frequency_penalty).toBe(0.5);
        expect(result.presence_penalty).toBe(0.3);
        expect(result.stream).toBe(false);
    });

    it('should include tool_choice when provided', () => {
        const tools: Tool[] = [
            {
                toolName: 'specific_tool',
                desc: 'Specific tool',
                paramsSchema: z.object({ input: z.string() }),
            },
        ];
        const messages = [{ role: 'user' as const, content: 'Hello' }];
        const toolChoice = { type: 'function' as const, function: { name: 'specific_tool' } };

        const result = createOpenAIFunctionCallingParams(tools, messages, 'gpt-4', {
            tool_choice: toolChoice,
        });

        expect(result.tool_choice).toEqual(toolChoice);
    });

    it('should handle empty tools array', () => {
        const messages = [{ role: 'user' as const, content: 'Hello' }];

        const result = createOpenAIFunctionCallingParams([], messages, 'gpt-4');

        expect(result.tools).toEqual([]);
    });
});

describe('formatExamples (via convertTool)', () => {
    it('should format multiple examples correctly', () => {
        const tool: Tool = {
            toolName: 'multi_example_tool',
            desc: 'Tool with multiple examples',
            paramsSchema: z.object({ query: z.string() }),
            examples: [
                {
                    description: 'Example 1',
                    params: { query: 'test1' },
                },
                {
                    description: 'Example 2',
                    params: { query: 'test2' },
                    expectedResult: 'result2',
                },
            ],
        };

        const converter = new DefaultToolCallConverter();
        const result = converter.convertTool(tool);

        expect(result.function.description).toContain('Example 1');
        expect(result.function.description).toContain('Example 2');
        expect(result.function.description).toContain('test1');
        expect(result.function.description).toContain('test2');
        expect(result.function.description).toContain('result2');
    });

    it('should handle complex example parameters', () => {
        const tool: Tool = {
            toolName: 'complex_example_tool',
            desc: 'Tool',
            paramsSchema: z.object({ user: z.object({ name: z.string() }) }),
            examples: [
                {
                    description: 'Complex example',
                    params: { user: { name: 'John' } },
                    expectedResult: 'Success',
                },
            ],
        };

        const converter = new DefaultToolCallConverter();
        const result = converter.convertTool(tool);

        expect(result.function.description).toContain('John');
    });
});
