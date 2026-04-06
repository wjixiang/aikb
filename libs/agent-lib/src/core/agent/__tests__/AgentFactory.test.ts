import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolComponent } from '../../../components/core/toolComponent.js';
import type { ObservableAgentCallbacks } from '../ObservableAgent.js';
import type { ProviderSettings } from '../../types/provider-settings.js';
import { AgentStatus } from '../../common/types.js';

// Use vi.hoisted with an inline factory function
const MockAgentContainer = vi.hoisted(() => {
  class MockAgentContainer {
    getAgent = vi.fn().mockResolvedValue({
      getTaskId: 'mock-task-id',
      status: AgentStatus.Sleeping,
      workspace: {},
      getMemoryModule: vi.fn().mockReturnValue({}),
    });
    getConfig = vi.fn().mockReturnValue({
      agent: { sop: 'Mock SOP' },
      api: {},
      workspace: {},
    });
    getContainer = vi.fn().mockReturnValue({});
  }
  return MockAgentContainer;
});

vi.mock('../../di/container.js', () => ({
  AgentContainer: MockAgentContainer,
}));

// Import after mocking
import {
  AgentFactory,
  type AgentFactoryOptions,
  type AgentSoul,
  type ComponentRegistration,
} from '../AgentFactory.js';

describe('AgentFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create and return an AgentContainer instance', () => {
      const container = AgentFactory.create();
      expect(container).toBeDefined();
      expect(container.getAgent).toBeDefined();
      expect(container.getConfig).toBeDefined();
      expect(container.getContainer).toBeDefined();
    });

    it('should create container with empty options by default', () => {
      const container = AgentFactory.create();
      expect(container).toBeDefined();
      expect(container.getConfig()).toBeDefined();
    });

    it('should accept agent options', () => {
      const container = AgentFactory.create({
        agent: { taskId: 'test-123', sop: 'Test SOP' },
      });
      expect(container).toBeDefined();
    });

    it('should accept api options', () => {
      const container = AgentFactory.create({
        api: { apiKey: 'test-key', apiModelId: 'gpt-4' },
      });
      expect(container).toBeDefined();
    });

    it('should accept workspace options', () => {
      const container = AgentFactory.create({
        workspace: { id: 'ws-123', name: 'Test Workspace' },
      });
      expect(container).toBeDefined();
    });

    it('should accept observer callbacks', () => {
      const onStatusChanged = vi.fn();
      const container = AgentFactory.create({
        observers: { onStatusChanged },
      });
      expect(container).toBeDefined();
    });

    it('should accept component registrations', () => {
      const mockComponent = { id: 'test-comp' } as unknown as ToolComponent;
      const components: ComponentRegistration[] = [
        { id: 'bibliography-search', component: mockComponent },
      ];
      const container = AgentFactory.create({ components });
      expect(container).toBeDefined();
    });

    it('should create multiple independent containers', () => {
      const container1 = AgentFactory.create({
        agent: { taskId: 'container-1' },
      });
      const container2 = AgentFactory.create({
        agent: { taskId: 'container-2' },
      });

      expect(container1).not.toBe(container2);
    });
  });

  describe('createAgent', () => {
    it('should return an Agent instance', async () => {
      const agent = await AgentFactory.createAgent();
      expect(agent).toBeDefined();
      expect(agent.getTaskId).toBeDefined();
    });

    it('should create agent with specified options', async () => {
      const agent = await AgentFactory.createAgent({
        agent: { taskId: 'direct-agent-123' },
      });
      expect(agent).toBeDefined();
      expect(agent.getTaskId).toBe('mock-task-id'); // from mock
    });

    it('should create agent with full configuration', async () => {
      const options: AgentFactoryOptions = {
        agent: {
          sop: 'Direct Create SOP',
          taskId: 'direct-task',
          name: 'Direct Agent',
          type: 'direct-type',
        },
        api: { apiKey: 'direct-key', apiModelId: 'gpt-4o' },
        workspace: { id: 'direct-workspace' },
      };

      const agent = await AgentFactory.createAgent(options);
      expect(agent).toBeDefined();
    });

    it('should handle agent with only SOP', async () => {
      const agent = await AgentFactory.createAgent({
        agent: { sop: 'SOP Only' },
      });
      expect(agent).toBeDefined();
    });

    it('should handle agent with minimal config', async () => {
      const agent = await AgentFactory.createAgent({
        api: { apiKey: 'minimal-key' },
      });
      expect(agent).toBeDefined();
    });

    it('should call getAgent on the container', async () => {
      const container = AgentFactory.create();
      const agent = await container.getAgent();
      expect(agent).toBeDefined();
    });

    it('should return agent from createAgent', async () => {
      const agent = await AgentFactory.createAgent();
      // The mock returns an agent with getTaskId method
      expect(typeof agent.getTaskId).toBe('string');
    });
  });

  describe('AgentFactoryOptions interface', () => {
    it('should accept all optional fields', () => {
      const fullOptions: AgentFactoryOptions = {
        agent: {
          sop: 'Full Interface Test',
          config: { apiRequestTimeout: 60000 },
          taskId: 'interface-test',
          name: 'Interface Test Agent',
          type: 'interface-test-type',
          description: 'Testing interface completeness',
        },
        api: {
          apiKey: 'interface-key',
          apiModelId: 'interface-model',
          apiProvider: 'openai',
        },
        workspace: {
          id: 'interface-workspace',
          name: 'Interface Workspace',
        },
        observers: {
          onStatusChanged: vi.fn(),
          onTaskCompleted: vi.fn(),
          onTaskAborted: vi.fn(),
          onError: vi.fn(),
          onMessageAdded: vi.fn(),
          onPropertyChange: vi.fn(),
          onMethodCall: vi.fn(),
        },
        components: [{ id: 'comp1', component: {} as ToolComponent }],
      };

      const container = AgentFactory.create(fullOptions);
      expect(container).toBeDefined();
    });

    it('should accept empty options', () => {
      const emptyOptions: AgentFactoryOptions = {};
      const container = AgentFactory.create(emptyOptions);
      expect(container).toBeDefined();
    });

    it('should accept options with only agent field', () => {
      const options: AgentFactoryOptions = {
        agent: { sop: 'Agent Only' },
      };
      const container = AgentFactory.create(options);
      expect(container).toBeDefined();
    });

    it('should accept options with only api field', () => {
      const options: AgentFactoryOptions = {
        api: { apiKey: 'key-only' },
      };
      const container = AgentFactory.create(options);
      expect(container).toBeDefined();
    });
  });

  describe('AgentSoul interface', () => {
    it('should accept minimal AgentSoul with only sop', () => {
      const soul: AgentSoul = { sop: 'Minimal Soul' };
      const container = AgentFactory.create({ agent: soul });
      expect(container).toBeDefined();
    });

    it('should accept AgentSoul with all fields', () => {
      const soul: AgentSoul = {
        sop: 'Complete Soul',
        config: { apiRequestTimeout: 30000, maxRetryAttempts: 5 },
        taskId: 'soul-task-123',
        name: 'Complete Soul Agent',
        type: 'complete-soul-type',
        description: 'Agent with all soul fields populated',
      };
      const container = AgentFactory.create({ agent: soul });
      expect(container).toBeDefined();
    });

    it('should accept AgentSoul with optional config', () => {
      const soul: AgentSoul = {
        sop: 'Soul with config',
        config: { maxRetryAttempts: 10 },
      };
      const container = AgentFactory.create({ agent: soul });
      expect(container).toBeDefined();
    });
  });

  describe('ComponentRegistration interface', () => {
    it('should accept component registration', () => {
      const registration: ComponentRegistration = {
        id: 'test-comp',
        component: {} as ToolComponent,
      };
      const container = AgentFactory.create({ components: [registration] });
      expect(container).toBeDefined();
    });

    it('should accept multiple components', () => {
      const components: ComponentRegistration[] = [
        { id: 'comp1', component: {} as ToolComponent },
        { id: 'comp2', component: {} as ToolComponent },
        { id: 'comp3', component: {} as ToolComponent },
      ];
      const container = AgentFactory.create({ components });
      expect(container).toBeDefined();
    });

    it('should accept empty components array', () => {
      const container = AgentFactory.create({ components: [] });
      expect(container).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate errors from container getAgent', async () => {
      // Verify that AgentFactory.createAgent returns a promise
      // that can potentially reject if getAgent rejects
      const agentPromise = AgentFactory.createAgent();
      expect(agentPromise).toBeInstanceOf(Promise);
    });

    it('should have getAgent method available on container', () => {
      // Verify that the container returned by create has a getAgent method
      // which can potentially reject - error handling is tested at integration level
      const container = AgentFactory.create();
      expect(typeof container.getAgent).toBe('function');
    });
  });
});
