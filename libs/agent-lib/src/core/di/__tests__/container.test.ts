import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { AgentContainer } from '../container.js';
import { TYPES } from '../types.js';
import { Agent } from '../../agent/agent.js';
import { VirtualWorkspace } from '../../statefulContext/virtualWorkspace.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { IVirtualWorkspace } from '../../statefulContext/index.js';
import { IMemoryModule } from '../../memory/types.js';
import { AgentFactory } from '../../agent/AgentFactory.js';
import { MessageBus } from '../../runtime/topology/messaging/MessageBus.js';
import type { IMessageBus } from '../../runtime/topology/messaging/MessageBus.js';

// Create a mock messageBus for testing
function createMockMessageBus(): IMessageBus {
  return new MessageBus();
}

describe('AgentContainer', () => {
  describe('Basic Container Setup', () => {
    it('should create a container instance', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({}, messageBus);
      expect(container).toBeInstanceOf(AgentContainer);
    });

    it('should provide access to the underlying container', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({}, messageBus);
      const internalContainer = container.getContainer();
      expect(internalContainer).toBeInstanceOf(Container);
    });

    it('should create agent via getAgent()', async () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({ api: { apiKey: 'test-key' } }, messageBus);
      const agent = await container.getAgent();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should return same agent instance on multiple getAgent() calls', async () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({ api: { apiKey: 'test-key' } }, messageBus);
      const agent1 = await container.getAgent();
      const agent2 = await container.getAgent();
      expect(agent1).toBe(agent2);
    });
  });

  describe('Service Bindings', () => {
    it('should bind services as singletons within container', async () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({ api: { apiKey: 'test-key' } }, messageBus);
      const agent = await container.getAgent();
      const workspace = agent.workspace;
      const memoryModule = agent.getMemoryModule();

      expect(workspace).toBeInstanceOf(VirtualWorkspace);
      expect(memoryModule).toBeInstanceOf(MemoryModule);
    });

    it('should have isolated services per container', async () => {
      const messageBus1 = createMockMessageBus();
      const messageBus2 = createMockMessageBus();
      const container1 = new AgentContainer({ api: { apiKey: 'key-1' } }, messageBus1);
      const container2 = new AgentContainer({ api: { apiKey: 'key-2' } }, messageBus2);

      const agent1 = await container1.getAgent();
      const agent2 = await container2.getAgent();

      expect(agent1.workspace).not.toBe(agent2.workspace);
      expect(agent1.getMemoryModule()).not.toBe(agent2.getMemoryModule());
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when no options provided', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({}, messageBus);
      const config = container.getConfig();
      expect(config.agent.sop).toBe('Default SOP');
      expect(config.api.apiProvider).toBe('zai');
    });

    it('should accept custom agent configuration', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({
        agent: {
          sop: 'Custom SOP',
          config: { apiRequestTimeout: 90000 },
        },
      }, messageBus);
      const config = container.getConfig();
      expect(config.agent.sop).toBe('Custom SOP');
      expect(config.agent.config.apiRequestTimeout).toBe(90000);
    });

    it('should accept custom API configuration', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({
        api: {
          apiModelId: 'custom-model',
          apiKey: 'test-key',
        },
      }, messageBus);
      const config = container.getConfig();
      expect(config.api.apiModelId).toBe('custom-model');
      expect(config.api.apiKey).toBe('test-key');
    });

    it('should merge partial agent config with defaults', () => {
      const messageBus = createMockMessageBus();
      const container = new AgentContainer({
        agent: {
          config: { apiRequestTimeout: 90000 },
        },
      }, messageBus);
      const config = container.getConfig();
      expect(config.agent.config.apiRequestTimeout).toBe(90000);
      expect(config.agent.config.maxRetryAttempts).toBe(3); // Default preserved
    });

    it('should accept workspace configuration', () => {
      const container = new AgentContainer({
        workspace: {
          id: 'custom-workspace',
          name: 'My Workspace',
        },
      });
      const config = container.getConfig();
      expect(config.workspace.id).toBe('custom-workspace');
      expect(config.workspace.name).toBe('My Workspace');
    });

    it('should accept taskId', async () => {
      const container = new AgentContainer({
        agent: {
          taskId: 'test-task-123',
        },
        api: {
          apiKey: 'test-key',
        },
      });
      const agent = await container.getAgent();
      expect(agent.getTaskId).toBe('test-task-123');
    });
  });

  describe('Agent Access', () => {
    it('should create agent with correct configuration', async () => {
      const container = new AgentContainer({
        agent: {
          sop: 'Test SOP',
          taskId: 'test-123',
        },
        api: { apiKey: 'test-key' },
      });
      const agent = await container.getAgent();
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getTaskId).toBe('test-123');
    });

    it('should have workspace available on agent', async () => {
      const container = new AgentContainer({
        api: { apiKey: 'test-key' },
      });
      const agent = await container.getAgent();
      expect(agent.workspace).toBeDefined();
      expect(agent.workspace).toBeInstanceOf(VirtualWorkspace);
    });

    it('should have memory module available on agent', async () => {
      const container = new AgentContainer({
        api: { apiKey: 'test-key' },
      });
      const agent = await container.getAgent();
      expect(agent.getMemoryModule()).toBeDefined();
    });
  });
});

describe('AgentFactory', () => {
  describe('create', () => {
    it('should create a container with Agent', async () => {
      const container = AgentFactory.create({
        agent: { sop: 'Test SOP' },
        api: { apiKey: 'test-key' },
      });
      expect(container).toBeInstanceOf(AgentContainer);
      expect(await container.getAgent()).toBeInstanceOf(Agent);
    });

    it('should pass configuration to container', async () => {
      const container = AgentFactory.create({
        agent: {
          sop: 'Factory SOP',
          taskId: 'factory-task',
        },
        api: { apiKey: 'test-key' },
      });
      const agent = await container.getAgent();
      expect(agent.getTaskId).toBe('factory-task');
    });
  });

  describe('createAgent', () => {
    it('should create and return agent directly', async () => {
      const agent = await AgentFactory.createAgent({
        agent: { sop: 'Direct SOP' },
        api: { apiKey: 'test-key' },
      });
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should accept full configuration', async () => {
      const agent = await AgentFactory.createAgent({
        agent: {
          sop: 'Full Config SOP',
          taskId: 'full-config-task',
          config: { apiRequestTimeout: 120000 },
        },
        api: { apiModelId: 'custom-model', apiKey: 'test-key' },
      });
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getTaskId).toBe('full-config-task');
    });
  });
});

describe('Multiple Containers', () => {
  it('should create isolated agents in separate containers', async () => {
    const container1 = new AgentContainer({
      agent: { taskId: 'agent-1' },
      api: { apiKey: 'key-1' },
    });
    const container2 = new AgentContainer({
      agent: { taskId: 'agent-2' },
      api: { apiKey: 'key-2' },
    });

    const agent1 = await container1.getAgent();
    const agent2 = await container2.getAgent();

    expect(agent1).not.toBe(agent2);
    expect(agent1.getTaskId).toBe('agent-1');
    expect(agent2.getTaskId).toBe('agent-2');
    expect(agent1.workspace).not.toBe(agent2.workspace);
  });

  it('should have independent configurations', () => {
    const container1 = new AgentContainer({
      agent: { sop: 'SOP 1' },
      api: { apiModelId: 'model-1', apiKey: 'key-1' },
    });
    const container2 = new AgentContainer({
      agent: { sop: 'SOP 2' },
      api: { apiModelId: 'model-2', apiKey: 'key-2' },
    });

    expect(container1.getConfig().agent.sop).toBe('SOP 1');
    expect(container2.getConfig().agent.sop).toBe('SOP 2');
    expect(container1.getConfig().api.apiModelId).toBe('model-1');
    expect(container2.getConfig().api.apiModelId).toBe('model-2');
  });
});
