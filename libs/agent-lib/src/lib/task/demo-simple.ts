/**
 * Simple demo script to test simplified Task entity
 * This demonstrates core functionality without external dependencies
 */

// Mock API handler to avoid external dependencies
class MockApiHandler {
  getModel() {
    return {
      info: {
        supportsToolCalling: true,
        supportsImageInput: false,
        supportsComputerUse: false,
        maxTokens: 100000,
        inputPrice: 0.015,
        outputPrice: 0.075,
        cacheWritesPrice: 0.000375,
        cacheReadsPrice: 0.0000375,
      }
    };
  }

  async *createMessage(systemPrompt: string, messages: any[], metadata: any) {
    // Mock streaming response
    yield { type: 'text', text: 'Hello! I can help you with your task.' };
    yield { type: 'usage', inputTokens: 50, outputTokens: 20 };
  }
}

// Mock buildApiHandler function
function buildApiHandler(config: any) {
  return new MockApiHandler();
}

// Mock other dependencies
const mockTypes = {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT: 5,
  getApiProtocol: () => 'anthropic',
  getModelId: () => 'claude-3-5-sonnet-20241022',
};

const mockUtils = {
  resolveToolProtocol: () => 'native',
};

// Simplified Task class for demo
class Task {
  readonly taskId: string;
  private _status: 'running' | 'completed' | 'aborted' = 'running';
  readonly instanceId: string;
  private api: any;

  constructor(taskId: string, private apiConfiguration: any) {
    this.taskId = taskId;
    this.instanceId = crypto.randomUUID().slice(0, 8);
    this.api = buildApiHandler(apiConfiguration);
  }

  start() {
    (this._status as 'running' | 'completed' | 'aborted') = 'running';
    return { event: 'task.started', data: { taskId: this.taskId } };
  }

  complete(tokenUsage: any, toolUsage: any) {
    (this._status as 'running' | 'completed' | 'aborted') = 'completed';
    return {
      event: 'task.completed',
      data: { taskId: this.taskId, tokenUsage, toolUsage },
    };
  }

  abort() {
    (this._status as 'running' | 'completed' | 'aborted') = 'aborted';
    return { event: 'task.aborted', data: { taskId: this.taskId } };
  }

  async recursivelyMakeClineRequests(
    userContent: any[],
    includeFileDetails: boolean = false,
  ): Promise<boolean> {
    console.log('🔄 Making recursive API requests...');
    console.log(`   Status: ${(this._status as 'running' | 'completed' | 'aborted')}`);
    console.log(`   User content length: ${userContent.length}`);
    console.log(`   Include file details: ${includeFileDetails}`);
    
    // Mock core logic
    try {
      const stream = this.api.createMessage('system prompt', [], {});
      
      for await (const chunk of stream) {
        console.log(`   Received chunk: ${chunk.type}`);
      }
      
      console.log('✅ Recursive requests completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in recursive requests:', error);
      return false;
    }
  }
}

async function demoSimpleTask() {
  console.log('🚀 Starting Simple Task Demo');
  
  try {
    // Create a new task
    const task = new Task('demo-task-123', {
      apiProvider: 'anthropic',
      apiKey: 'test-key',
      modelId: 'claude-3-5-sonnet-20241022'
    });
    
    console.log('✅ Task created successfully');
    console.log(`   Task ID: ${task.taskId}`);
    console.log(`   Instance ID: ${task.instanceId}`);
    console.log(`   Initial status: ${(task as any)._status}`);
    
    // Test status management
    const startEvent = task.start();
    console.log('✅ Task started:', startEvent);
    
    // Test core recursivelyMakeClineRequests method
    const result = await task.recursivelyMakeClineRequests([
      { type: 'text', text: 'Hello, can you help me with a task?' }
    ]);
    console.log('✅ Core method executed:', result);
    
    const completeEvent = task.complete(
      { inputTokens: 100, outputTokens: 200 }, 
      { read_file: { attempts: 1, failures: 0 } }
    );
    console.log('✅ Task completed:', completeEvent);
    
    // Create another task for testing
    const task2 = new Task('demo-task-456', {
      apiProvider: 'anthropic',
      apiKey: 'test-key',
      modelId: 'claude-3-5-sonnet-20241022'
    });
    const abortEvent = task2.abort();
    console.log('✅ Task aborted:', abortEvent);
    
    console.log('🎉 Demo completed successfully!');
    console.log('');
    console.log('📋 Summary of what was demonstrated:');
    console.log('   ✅ Task creation and initialization');
    console.log('   ✅ Status management (start, complete, abort)');
    console.log('   ✅ Core recursivelyMakeClineRequests method');
    console.log('   ✅ Simplified dependencies (no external modules)');
    console.log('   ✅ Standalone functionality (no core dependencies)');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run demo
if (require.main === module) {
  demoSimpleTask();
}

export { demoSimpleTask, Task };