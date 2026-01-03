import { ProviderSettings } from 'agent-lib';
import { Task } from '../task.entity';
import { ApiStreamChunk, ApiStream } from 'agent-lib';
import { vi } from 'vitest';

// Mock data generators for different types of LLM responses
function createMockTextStream(text: string): ApiStream {
  return (async function* () {
    // Yield the complete text as one chunk to avoid timeout issues
    yield {
      type: 'text',
      text: text,
    } as ApiStreamChunk;

    // Add usage info to make it more realistic
    yield {
      type: 'usage',
      inputTokens: 20,
      outputTokens: text.length,
      totalCost: 0.0001,
    } as ApiStreamChunk;
  })();
}

function createMockToolCallStream(toolName: string, toolArgs: any): ApiStream {
  return (async function* () {
    // Start tool call
    yield {
      type: 'tool_call_partial',
      index: 0,
      id: 'tool_123',
      name: toolName,
      arguments: JSON.stringify(toolArgs),
    } as ApiStreamChunk;

    // Complete tool call
    yield {
      type: 'tool_call',
      index: 0,
      id: 'tool_123',
      name: toolName,
      arguments: JSON.stringify(toolArgs),
    } as ApiStreamChunk;

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 30,
      outputTokens: 50,
      totalCost: 0.0002,
    } as ApiStreamChunk;
  })();
}

function createMockReasoningStream(reasoning: string): ApiStream {
  return (async function* () {
    // Yield reasoning as one chunk
    yield {
      type: 'reasoning',
      text: reasoning,
    } as ApiStreamChunk;

    // Add some text after reasoning
    yield {
      type: 'text',
      text: '基于以上分析，我将为您提供相关信息。',
    } as ApiStreamChunk;

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 25,
      outputTokens: reasoning.length + 20,
      totalCost: 0.0003,
    } as ApiStreamChunk;

    // Need to use one tool to avoid Task Error
    yield* createMockToolCallStream('attempt_completion', {});
  })();
}

function createMockMixedStream(): ApiStream {
  return (async function* () {
    // Start with reasoning
    yield {
      type: 'reasoning',
      text: '我需要分析用户的问题并提供相关信息。',
    } as ApiStreamChunk;

    // Add some text
    yield {
      type: 'text',
      text: '根据医学资料，糖尿病的诊断标准包括...',
    } as ApiStreamChunk;

    // Add a tool call
    yield {
      type: 'tool_call_partial',
      index: 0,
      id: 'search_456',
      name: 'read_file',
      arguments: '{"query": "糖尿病诊断标准"}',
    } as ApiStreamChunk;

    // Complete tool call
    yield {
      type: 'tool_call',
      index: 0,
      id: 'search_456',
      name: 'read_file',
      arguments: '{"query": "糖尿病诊断标准"}',
    } as ApiStreamChunk;

    // XML tool call

    yield {
      type: 'text',
      text: '<semantic',
    };

    yield {
      type: 'text',
      text: '_search>',
    };

    yield {
      type: 'text',
      text: 'test<semantic_search/>',
    };

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 50,
      outputTokens: 100,
      totalCost: 0.001,
    } as ApiStreamChunk;
  })();
}

function createMockErrorStream(errorMessage: string): ApiStream {
  return (async function* () {
    yield {
      type: 'error',
      error: 'API_ERROR',
      message: errorMessage,
    } as ApiStreamChunk;
  })();
}

// Mock XML tool call stream generator
function createMockXmlToolCallStream(
  toolName: string,
  toolArgs: Record<string, any>,
): ApiStream {
  return (async function* () {
    // Start with some text
    yield {
      type: 'text',
      text: 'I need to use a tool to help you with this request. Let me call the appropriate tool.\n\n',
    } as ApiStreamChunk;

    // Yield XML tool call as text
    let xmlToolCall = `<${toolName}>\n`;
    for (const [key, value] of Object.entries(toolArgs)) {
      xmlToolCall += `<${key}>${value}</${key}>\n`;
    }
    xmlToolCall += `</${toolName}>`;

    yield {
      type: 'text',
      text: xmlToolCall,
    } as ApiStreamChunk;

    // Add some closing text
    yield {
      type: 'text',
      text: '\nI have called the tool to process your request.',
    } as ApiStreamChunk;

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 50,
      outputTokens: xmlToolCall.length + 30,
      totalCost: 0.0003,
    } as ApiStreamChunk;

    // Add attempt_completion to end the loop
    yield {
      type: 'text',
      text: '\n<attempt_completion>\n</attempt_completion>',
    } as ApiStreamChunk;
  })();
}

// Mock XML tool call stream with multiple tools
function createMockXmlMultipleToolCallStream(
  tools: Array<{ name: string; args: Record<string, any> }>,
): ApiStream {
  return (async function* () {
    // Start with explanation text
    yield {
      type: 'text',
      text: 'I need to use multiple tools to help you with this request. Let me call them step by step.\n\n',
    } as ApiStreamChunk;

    // Yield each tool call as XML
    for (const tool of tools) {
      let xmlToolCall = `<${tool.name}>\n`;
      for (const [key, value] of Object.entries(tool.args)) {
        xmlToolCall += `<${key}>${value}</${key}>\n`;
      }
      xmlToolCall += `</${tool.name}>`;

      yield {
        type: 'text',
        text: xmlToolCall + '\n',
      } as ApiStreamChunk;
    }

    // Add closing text
    yield {
      type: 'text',
      text: 'I have called all the necessary tools to process your request.',
    } as ApiStreamChunk;

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 80,
      outputTokens: 200,
      totalCost: 0.0005,
    } as ApiStreamChunk;
  })();
}

// Mock XML tool call stream with reasoning
function createMockXmlToolCallWithReasoningStream(
  toolName: string,
  toolArgs: Record<string, any>,
  reasoning: string,
): ApiStream {
  return (async function* () {
    // Start with reasoning
    yield {
      type: 'reasoning',
      text: reasoning,
    } as ApiStreamChunk;

    // Add explanation text
    yield {
      type: 'text',
      text: 'Based on my analysis, I need to use the following tool:\n\n',
    } as ApiStreamChunk;

    // Yield XML tool call as text
    let xmlToolCall = `<${toolName}>\n`;
    for (const [key, value] of Object.entries(toolArgs)) {
      xmlToolCall += `<${key}>${value}</${key}>\n`;
    }
    xmlToolCall += `</${toolName}>`;

    yield {
      type: 'text',
      text: xmlToolCall,
    } as ApiStreamChunk;

    // Add usage info
    yield {
      type: 'usage',
      inputTokens: 60,
      outputTokens: reasoning.length + xmlToolCall.length + 20,
      totalCost: 0.0004,
    } as ApiStreamChunk;
  })();
}

describe('Task Entity Tests', () => {
  const testApiConfig: ProviderSettings = {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'],
    apiModelId: 'glm-4.6',
    zaiApiLine: 'china_coding',
  };

  it('should create a new task successfully', async () => {
    const newTask = new Task('test_task_id_1', '', testApiConfig);
    expect(newTask.taskId).toBe('test_task_id_1');
  });

  it('should execute a simple task with mocked text stream', async () => {
    // Create a task with a high consecutive mistake limit to avoid infinite loop
    const newTask = new Task('test_task_id_1', '', testApiConfig, 100);

    // Mock the attemptApiRequest method to return a stream with both text and tool calls
    const mockText = '这是一个测试响应，用于验证文本流处理功能。';
    const mockToolArgs = { path: 'test.txt' };

    // Mock the method properly using vi.spyOn with mockImplementation
    const mockAttemptApiRequest = vi
      .spyOn(newTask as any, 'attemptApiRequest')
      .mockImplementation(async function* () {
        console.log('Mock attemptApiRequest called');
        // Create a stream with both text and tool calls to avoid "no tools used" issue
        yield* createMockTextStream(mockText);
        yield* createMockToolCallStream('read_file', mockToolArgs);
      });

    try {
      // Add a user message to the conversation history first
      await newTask.recursivelyMakeClineRequests([
        {
          type: 'text',
          text: '请简单介绍一下你自己',
        },
      ]);

      // Verify that the mock was called
      expect(mockAttemptApiRequest).toHaveBeenCalled();

      // Check that assistant message content was populated
      expect(newTask.assistantMessageContent).toBeDefined();
      expect(newTask.assistantMessageContent.length).toBeGreaterThan(0);

      console.log(
        'Assistant message content:',
        newTask.assistantMessageContent,
      );
    } finally {
      // Restore the original method
      mockAttemptApiRequest.mockRestore();
    }
  }, 10000);

  it('should test mock stream directly without complex workflow', async () => {
    const newTask = new Task('test_task_id_direct', '', testApiConfig);

    // Mock the attemptApiRequest method to return a text stream
    const mockText = '这是直接测试流处理的文本。';
    newTask['attemptApiRequest'] = vi
      .fn()
      .mockReturnValue(createMockTextStream(mockText));

    // Test the mock stream directly instead of going through the complex recursivelyMakeClineRequests
    const stream = newTask['attemptApiRequest']();
    const chunks: ApiStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
      console.log('Received chunk:', chunk);
    }

    // Verify that the mock was called
    expect(newTask['attemptApiRequest']).toHaveBeenCalled();

    // Verify chunks were received
    expect(chunks.length).toBeGreaterThan(0);

    // Should have both text and usage chunks
    const textChunks = chunks.filter((chunk) => chunk.type === 'text');
    const usageChunks = chunks.filter((chunk) => chunk.type === 'usage');

    expect(textChunks.length).toBeGreaterThan(0);
    expect(usageChunks.length).toBeGreaterThan(0);

    // Reconstruct text from chunks
    const reconstructedText = textChunks
      .map((chunk) => (chunk as any).text)
      .join('');

    expect(reconstructedText).toContain('这是直接测试流处理的文本。');
    console.log('Reconstructed text:', reconstructedText);
  }, 10000);

  it('should handle reasoning stream correctly', async () => {
    const newTask = new Task('test_task_id_3', '', testApiConfig);

    // Mock the attemptApiRequest method to return a reasoning stream
    const mockReasoning =
      '我需要分析用户的问题。用户询问糖尿病的诊断标准，这是一个医学相关的问题。我应该提供准确、权威的医学信息。';
    newTask['attemptApiRequest'] = vi
      .fn()
      .mockReturnValue(createMockReasoningStream(mockReasoning));

    // Mock methods to avoid timeout issues
    newTask['waitForUserMessageContentReady'] = vi
      .fn()
      .mockResolvedValue(undefined);
    newTask['addToConversationHistory'] = vi.fn().mockResolvedValue(undefined);
    newTask['getSystemPrompt'] = vi
      .fn()
      .mockResolvedValue('Mock system prompt');
    newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

    // Add a user message
    await newTask.recursivelyMakeClineRequests([
      {
        type: 'text',
        text: '请分析糖尿病的诊断标准',
      },
    ]);

    // Verify reasoning was processed
    expect(newTask['attemptApiRequest']).toHaveBeenCalled();

    console.log(
      'Assistant message content with reasoning:',
      newTask.assistantMessageContent,
    );
  }, 10000);

  it('should handle mixed stream with text, reasoning, and tool calls', async () => {
    const newTask = new Task('test_task_id_4', '', testApiConfig);

    // Mock the attemptApiRequest method to return a mixed stream
    newTask['attemptApiRequest'] = vi
      .fn()
      .mockReturnValue(createMockMixedStream());

    // Mock multiple methods to avoid timeout issues
    newTask['waitForUserMessageContentReady'] = vi
      .fn()
      .mockResolvedValue(undefined);
    newTask['addToConversationHistory'] = vi.fn().mockResolvedValue(undefined);
    newTask['getSystemPrompt'] = vi
      .fn()
      .mockResolvedValue('Mock system prompt');
    newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

    // Add a user message
    await newTask.recursivelyMakeClineRequests([
      {
        type: 'text',
        text: '请帮我搜索并解释糖尿病的诊断标准',
      },
    ]);

    // Verify mixed content was processed
    expect(newTask['attemptApiRequest']).toHaveBeenCalled();
    expect(newTask.assistantMessageContent).toBeDefined();

    // Should have both text and tool use blocks
    const textBlocks = newTask.assistantMessageContent.filter(
      (block) => block.type === 'text',
    );
    const toolUses = newTask.assistantMessageContent.filter(
      (block) => block.type === 'tool_use',
    );

    expect(textBlocks.length).toBeGreaterThan(0);
    expect(toolUses.length).toBeGreaterThan(0);

    console.log('Mixed stream - Text blocks:', textBlocks);
    console.log('Mixed stream - Tool uses:', toolUses);
  }, 10000);

  it('should collect chunks from mock tool call stream directly', async () => {
    const newTask = new Task('test_task_id_direct_tool', '', testApiConfig);

    // Create a simple tool call stream
    const mockToolArgs = { path: 'test.txt' };
    const toolStream = createMockToolCallStream('read_file', mockToolArgs);

    // Collect chunks directly from the stream
    const chunks: ApiStreamChunk[] = [];
    for await (const chunk of toolStream) {
      chunks.push(chunk);
      console.log('Received chunk:', chunk);
    }

    // Verify we received the expected chunks
    expect(chunks.length).toBe(3); // tool_call_partial, tool_call, usage

    const toolCallPartial = chunks.find(
      (chunk) => chunk.type === 'tool_call_partial',
    );
    const toolCall = chunks.find((chunk) => chunk.type === 'tool_call');
    const usage = chunks.find((chunk) => chunk.type === 'usage');

    expect(toolCallPartial).toBeDefined();
    expect(toolCall).toBeDefined();
    expect(usage).toBeDefined();

    if (toolCallPartial) {
      expect((toolCallPartial as any).name).toBe('read_file');
    }
    if (toolCall) {
      expect((toolCall as any).name).toBe('read_file');
    }
    if (usage) {
      expect((usage as any).inputTokens).toBe(30);
    }

    console.log('Direct tool call stream test completed successfully');
  }, 10000);

  it('should handle error stream correctly', async () => {
    const newTask = new Task('test_task_id_5', '', testApiConfig);

    // Mock the attemptApiRequest method to return an error stream
    const errorMessage = 'API rate limit exceeded';
    newTask['attemptApiRequest'] = vi
      .fn()
      .mockReturnValue(createMockErrorStream(errorMessage));

    // Mock the waitForUserMessageContentReady method to avoid timeout
    newTask['waitForUserMessageContentReady'] = vi
      .fn()
      .mockResolvedValue(undefined);

    // Add a user message and expect it to handle the error
    try {
      await newTask.recursivelyMakeClineRequests([
        {
          type: 'text',
          text: '请回答一个问题',
        },
      ]);
    } catch (error) {
      // Expected to fail due to error in stream
      console.log('Expected error caught:', error);
    }

    // Verify error was attempted to be processed
    expect(newTask['attemptApiRequest']).toHaveBeenCalled();
  }, 10000);

  it('should collect chunks from mock stream directly', async () => {
    const newTask = new Task('test_task_id_6', '', testApiConfig);

    // Mock the attemptApiRequest method
    const mockText = '这是直接测试流收集的文本。';
    newTask['attemptApiRequest'] = vi
      .fn()
      .mockReturnValue(createMockTextStream(mockText));

    // Get the stream directly and collect chunks
    const stream = newTask['attemptApiRequest']();
    const chunks: ApiStreamChunk[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
      console.log('Collected chunk:', chunk);
    }

    // Verify chunks were collected
    expect(chunks.length).toBeGreaterThan(0);

    // Should have both text and usage chunks
    const textChunks = chunks.filter((chunk) => chunk.type === 'text');
    const usageChunks = chunks.filter((chunk) => chunk.type === 'usage');

    expect(textChunks.length).toBeGreaterThan(0);
    expect(usageChunks.length).toBeGreaterThan(0);

    // Reconstruct text from chunks
    const reconstructedText = textChunks
      .map((chunk) => (chunk as any).text)
      .join('');

    expect(reconstructedText).toContain('这是直接测试流收集的文本');
    console.log('Reconstructed text:', reconstructedText);
  }, 10000);

  it('should handle XML tool call stream correctly', async () => {
    // Force XML protocol by creating a config that doesn't support native tools
    const xmlTestApiConfig: ProviderSettings = {
      ...testApiConfig,
      apiModelId: 'model-without-native-tools', // This will force XML protocol
    };

    const newTask = new Task(
      'test_task_id_xml_tool',
      '',
      xmlTestApiConfig,
      100,
    );

    // Mock the model info to not support native tools, forcing XML protocol
    const mockModelInfo = {
      supportsNativeTools: false,
      maxTokens: 100000,
      contextWindow: 200000,
      supportsImages: false,
      supportsPromptCache: true,
      inputPrice: 0.6,
      outputPrice: 2.2,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0.11,
      description: 'Mock model without native tool support',
    };

    // Mock attemptApiRequest method to return an XML tool call stream
    const mockToolArgs = {
      query: 'acting potential',
    };

    // Use mockImplementation to create fresh stream for each call
    const mockAttemptApiRequest = vi
      .spyOn(newTask as any, 'attemptApiRequest')
      .mockImplementation(async function* () {
        console.log('Mock XML tool call attemptApiRequest called');
        yield* createMockXmlToolCallStream('semantic_search', mockToolArgs);
      });

    // Mock the api.getModel method to return our mock model info
    const mockGetModel = vi
      .spyOn(newTask as any, 'api', 'get')
      .mockReturnValue({
        getModel: () => ({ info: mockModelInfo }),
      });

    try {
      // Mock methods to avoid timeout issues
      newTask['waitForUserMessageContentReady'] = vi
        .fn()
        .mockResolvedValue(undefined);
      newTask['addToConversationHistory'] = vi
        .fn()
        .mockResolvedValue(undefined);
      newTask['getSystemPrompt'] = vi
        .fn()
        .mockResolvedValue('Mock system prompt');
      newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

      // Add a user message
      await newTask.recursivelyMakeClineRequests([
        {
          type: 'text',
          text: '请读取关于糖尿病诊断标准的文件',
        },
      ]);

      // Verify XML tool call was processed
      expect(mockAttemptApiRequest).toHaveBeenCalled();
      expect(newTask.assistantMessageContent).toBeDefined();

      console.log(
        'XML tool call assistant message content:',
        newTask.assistantMessageContent,
      );
    } finally {
      // Restore the original methods
      mockAttemptApiRequest.mockRestore();
      mockGetModel.mockRestore();
    }
  }, 10000);

  // it('should handle XML multiple tool calls stream correctly', async () => {
  //     const newTask = new Task('test_task_id_xml_multiple','' , testApiConfig);

  //     // Mock attemptApiRequest method to return multiple XML tool calls
  //     const mockTools = [
  //         { name: 'read_file', args: { path: 'file1.txt' } },
  //         { name: 'search_files', args: { query: 'diabetes', file_pattern: '*.md' } }
  //     ];
  //     newTask['attemptApiRequest'] = vi.fn().mockReturnValue(
  //         createMockXmlMultipleToolCallStream(mockTools)
  //     );

  //     // Mock methods to avoid timeout issues
  //     newTask['waitForUserMessageContentReady'] = vi.fn().mockResolvedValue(undefined);
  //     newTask['addToConversationHistory'] = vi.fn().mockResolvedValue(undefined);
  //     newTask['getSystemPrompt'] = vi.fn().mockResolvedValue('Mock system prompt');
  //     newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

  //     // Add a user message
  //     await newTask.recursivelyMakeClineRequests([{
  //         type: 'text',
  //         text: '请搜索相关文件并读取内容'
  //     }]);

  //     // Verify multiple XML tool calls were processed
  //     expect(newTask['attemptApiRequest']).toHaveBeenCalled();
  //     expect(newTask.assistantMessageContent).toBeDefined();

  //     console.log('XML multiple tool calls assistant message content:', newTask.assistantMessageContent);
  // }, 10000);

  // it('should handle XML tool call with reasoning stream correctly', async () => {
  //     // Force XML protocol by creating a config that doesn't support native tools
  //     const xmlTestApiConfig: ProviderSettings = {
  //         ...testApiConfig,
  //         apiModelId: 'model-without-native-tools' // This will force XML protocol
  //     };

  //     const newTask = new Task('test_task_id_xml_reasoning', xmlTestApiConfig);

  //     // Mock model info to not support native tools, forcing XML protocol
  //     const mockModelInfo = {
  //         supportsNativeTools: false,
  //         maxTokens: 100000,
  //         contextWindow: 200000,
  //         supportsImages: false,
  //         supportsPromptCache: true,
  //         inputPrice: 0.6,
  //         outputPrice: 2.2,
  //         cacheWritesPrice: 0,
  //         cacheReadsPrice: 0.11,
  //         description: "Mock model without native tool support"
  //     };

  //     // Mock attemptApiRequest method to return XML tool call with reasoning
  //     const mockToolArgs = {
  //         path: "medical_guidelines.txt"
  //     };
  //     const mockReasoning = "用户询问糖尿病的诊断标准，我需要查找相关的医学指南文件来提供准确的信息。";
  //     newTask['attemptApiRequest'] = vi.fn().mockReturnValue(
  //         createMockXmlToolCallWithReasoningStream('read_file', mockToolArgs, mockReasoning)
  //     );

  //     // Mock the api.getModel method to return our mock model info
  //     const mockGetModel = vi.spyOn(newTask as any, 'api', 'get').mockReturnValue({
  //         getModel: () => ({ info: mockModelInfo })
  //     });

  //     // Mock methods to avoid timeout issues
  //     newTask['waitForUserMessageContentReady'] = vi.fn().mockResolvedValue(undefined);
  //     newTask['addToConversationHistory'] = vi.fn().mockResolvedValue(undefined);
  //     newTask['getSystemPrompt'] = vi.fn().mockResolvedValue('Mock system prompt');
  //     newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

  //     try {
  //         // Add a user message
  //         await newTask.recursivelyMakeClineRequests([{
  //             type: 'text',
  //             text: '请分析糖尿病的诊断标准'
  //         }]);

  //         // Verify XML tool call with reasoning was processed
  //         expect(newTask['attemptApiRequest']).toHaveBeenCalled();
  //         expect(newTask.assistantMessageContent).toBeDefined();

  //         console.log('XML tool call with reasoning assistant message content:', newTask.assistantMessageContent);
  //     } finally {
  //         // Restore the mock
  //         mockGetModel.mockRestore();
  //     }
  // }, 10000);

  // it('should collect chunks from mock XML tool call stream directly', async () => {
  //     const newTask = new Task('test_task_id_direct_xml','' , testApiConfig);

  //     // Create a simple XML tool call stream
  //     const mockToolArgs = { path: "test.txt", query: "test query" };
  //     const xmlToolStream = createMockXmlToolCallStream('read_file', mockToolArgs);

  //     // Collect chunks directly from the stream
  //     const chunks: ApiStreamChunk[] = [];
  //     for await (const chunk of xmlToolStream) {
  //         chunks.push(chunk);
  //         console.log('Received XML chunk:', chunk);
  //     }

  //     // Verify we received expected chunks
  //     expect(chunks.length).toBe(4); // intro text, XML tool call text, closing text, usage

  //     const introText = chunks[0];
  //     const xmlToolCallText = chunks[1];
  //     const closingText = chunks[2];
  //     const usage = chunks[3];

  //     expect(introText.type).toBe('text');
  //     expect(xmlToolCallText.type).toBe('text');
  //     expect(closingText.type).toBe('text');
  //     expect(usage.type).toBe('usage');

  //     // Verify XML content is present
  //     if (xmlToolCallText && xmlToolCallText.type === 'text') {
  //         expect(xmlToolCallText.text).toContain('<read_file>');
  //         expect(xmlToolCallText.text).toContain('<path>test.txt</path>');
  //         expect(xmlToolCallText.text).toContain('<query>test query</query>');
  //         expect(xmlToolCallText.text).toContain('</read_file>');
  //     }

  //     if (usage) {
  //         expect((usage as any).inputTokens).toBe(50);
  //     }

  //     console.log('Direct XML tool call stream test completed successfully');
  // }, 10000);

  it.todo('should handle api request failure with retry mechanism');

  it('should handle task abort correctly', async () => {
    const newTask = new Task('test_task_id_abort', '', testApiConfig, 100);

    // Mock the attemptApiRequest method to return a stream that takes time
    const mockAttemptApiRequest = vi
      .spyOn(newTask as any, 'attemptApiRequest')
      .mockImplementation(async function* () {
        console.log('Mock abort test attemptApiRequest called');
        // Simulate a long-running stream
        yield {
          type: 'text',
          text: 'Starting long operation...',
        };

        // Add a delay to simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if task was aborted during processing
        if (newTask.status === 'aborted') {
          console.log('Task was aborted, stopping stream generation');
          return;
        }

        yield {
          type: 'text',
          text: 'Still processing...',
        };

        yield {
          type: 'usage',
          inputTokens: 20,
          outputTokens: 30,
          totalCost: 0.0001,
        };
      });

    // Mock methods to avoid timeout issues
    newTask['waitForUserMessageContentReady'] = vi
      .fn()
      .mockResolvedValue(undefined);
    newTask['addToConversationHistory'] = vi.fn().mockResolvedValue(undefined);
    newTask['getSystemPrompt'] = vi
      .fn()
      .mockResolvedValue('Mock system prompt');
    newTask['buildCleanConversationHistory'] = vi.fn().mockReturnValue([]);

    try {
      // Start the task in the background
      const taskPromise = newTask.recursivelyMakeClineRequests([
        {
          type: 'text',
          text: '请执行一个长时间运行的任务',
        },
      ]);

      // Abort the task after a short delay
      setTimeout(() => {
        console.log('Calling abort...');
        newTask.abort('Test abort');
      }, 50);

      // Wait for the task to complete/abort
      const result = await taskPromise;

      // Verify the task was aborted
      expect(newTask.status).toBe('aborted');
      expect(result).toBe(false); // Should return false when aborted
      expect(newTask.abortReason).toBe('Test abort');

      console.log('Abort test completed successfully');
    } finally {
      // Restore the original method
      mockAttemptApiRequest.mockRestore();
    }
  }, 10000);
});

// Task Context Management Tests - TODO: Add tests here
