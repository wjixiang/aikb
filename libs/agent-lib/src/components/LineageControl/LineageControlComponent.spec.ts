import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineageControlComponent } from './LineageControlComponent.js';
import {
  setGlobalAgentRegistry,
  getGlobalAgentRegistry,
  AgentCardRegistry,
} from '../../core/a2a/AgentCard.js';
import type { IA2AHandler, PendingTask } from '../../core/a2a/A2AHandler.js';
import type { IA2AClient } from '../../core/a2a/A2AClient.js';
import type { IAgentSleepControl } from '../../core/runtime/AgentSleepControl.js';
import { RuntimeControlState } from '../../core/runtime/RuntimeControlState.js';
import type { IRuntimeControlClient } from '../../core/runtime/types.js';
import type { AgentLineageInfo } from '../../core/runtime/types.js';
import { AgentStatus } from '../../core/common/types.js';

const INSTANCE_ID = 'test-instance-abc1234567890';

function createMockA2AHandler(): IA2AHandler {
  return {
    handleMessage: vi.fn(),
    onTask: vi.fn(),
    onQuery: vi.fn(),
    onEvent: vi.fn(),
    onCancel: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    getPendingTasks: vi.fn().mockReturnValue([]),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    sendTaskResult: vi.fn().mockResolvedValue(undefined),
    sendTaskError: vi.fn().mockResolvedValue(undefined),
    setTaskCompletionCallback: vi.fn(),
    completeTask: vi.fn(),
  };
}

function createMockA2AClient(): IA2AClient {
  return {
    sendTask: vi.fn().mockResolvedValue({}),
    sendTaskAndWaitForAck: vi.fn().mockResolvedValue('conv-123'),
    sendQuery: vi.fn().mockResolvedValue({ answer: 'yes' }),
    sendResponse: vi.fn().mockResolvedValue(undefined),
    sendEvent: vi.fn().mockResolvedValue(undefined),
    sendCancel: vi.fn().mockResolvedValue(undefined),
    waitForResult: vi.fn().mockResolvedValue({ output: 'done' }),
    getInstanceId: vi.fn().mockReturnValue(INSTANCE_ID),
  };
}

function createMockSleepControl(): IAgentSleepControl {
  return {
    isSleeping: vi.fn().mockReturnValue(false),
    sleep: vi.fn().mockResolvedValue(undefined),
    wakeUp: vi.fn(),
  };
}

function createMockRuntimeClient(): IRuntimeControlClient {
  return {
    createAgent: vi.fn().mockResolvedValue('new-agent-abc12345'),
    startAgent: vi.fn().mockResolvedValue(undefined),
    stopAgent: vi.fn().mockResolvedValue(undefined),
    destroyAgent: vi.fn().mockResolvedValue(undefined),
    resolveAgentId: vi.fn((id: string) => id),
    getAgent: vi.fn().mockResolvedValue({}),
    listAgents: vi.fn().mockResolvedValue([]),
    getSelfInstanceId: vi.fn().mockReturnValue(INSTANCE_ID),
    getParentInstanceId: vi.fn().mockReturnValue('parent-abc'),
    listChildAgents: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({
      totalAgents: 5,
      agentsByStatus: { running: 3, stopped: 2 },
    }),
    registerInTopology: vi.fn(),
    unregisterFromTopology: vi.fn(),
    connectAgents: vi.fn(),
    disconnectAgents: vi.fn(),
    getTopologyGraph: vi.fn(),
    getTopologyStats: vi.fn().mockReturnValue({
      totalMessages: 10,
      totalConversations: 5,
      activeConversations: 2,
      completedConversations: 2,
      failedConversations: 1,
      timedOutConversations: 0,
    }),
    sendA2ATask: vi.fn().mockResolvedValue({}),
    sendA2ATaskAndWaitForAck: vi.fn().mockResolvedValue('conv-123'),
    sendA2AQuery: vi.fn().mockResolvedValue({}),
    sendA2AEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function createRuntimeState(
  client?: IRuntimeControlClient,
): RuntimeControlState {
  const state = new RuntimeControlState();
  if (client) state.setRuntimeClient(client);
  return state;
}

function createLineage(
  role: 'root' | 'coordinator' | 'worker' = 'coordinator',
): AgentLineageInfo {
  return {
    schemaId: 'test-schema',
    soulToken: 'node-1',
    role,
    allowedChildren:
      role !== 'worker'
        ? [{ soulToken: 'worker-a' }]
        : [],
  };
}

function createComponent(opts?: {
  lineage?: AgentLineageInfo;
  runtimeClient?: IRuntimeControlClient;
}) {
  const a2aHandler = createMockA2AHandler();
  const a2aClient = createMockA2AClient();
  const sleepControl = createMockSleepControl();
  const runtimeState = opts?.runtimeClient
    ? createRuntimeState(opts.runtimeClient)
    : undefined;
  const lineage = opts?.lineage;

  const component = new LineageControlComponent(
    INSTANCE_ID,
    a2aHandler,
    a2aClient,
    sleepControl,
    runtimeState,
    lineage,
  );

  return { component, a2aHandler, a2aClient, sleepControl, runtimeState };
}

describe('LineageControlComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGlobalAgentRegistry(new AgentCardRegistry());
  });

  describe('constructor', () => {
    it('should create instance with no lineage', () => {
      const { component } = createComponent();
      expect(component).toBeInstanceOf(LineageControlComponent);
      expect(component.componentId).toBe('lineage-control');
      expect(component.displayName).toBe('Lineage Control');
    });

    it('should create instance with coordinator lineage', () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });
      expect(component).toBeInstanceOf(LineageControlComponent);
    });

    it('should create instance with worker lineage', () => {
      const { component } = createComponent({
        lineage: createLineage('worker'),
      });
      expect(component).toBeInstanceOf(LineageControlComponent);
    });
  });

  describe('componentPrompt', () => {
    it('should return noLineagePrompt when no lineage', () => {
      const { component } = createComponent();
      expect(component.componentPrompt).toContain('Agent Mailbox');
      expect(component.componentPrompt).toContain('discoverAgents');
    });

    it('should return workerPrompt when role is worker', () => {
      const { component } = createComponent({
        lineage: createLineage('worker'),
      });
      expect(component.componentPrompt).toContain('worker agent');
      expect(component.componentPrompt).toContain('checkInbox');
      expect(component.componentPrompt).not.toContain('createAgentByType');
    });

    it('should return coordinatorPrompt when role is coordinator', () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });
      expect(component.componentPrompt).toContain('coordinator');
      expect(component.componentPrompt).toContain('child agents');
      expect(component.componentPrompt).toContain('worker-a');
    });

    it('should return coordinatorPrompt when role is root', () => {
      const { component } = createComponent({ lineage: createLineage('root') });
      expect(component.componentPrompt).toContain('coordinator');
    });
  });

  describe('toolDefs', () => {
    it('should include inbox tools for all roles', () => {
      const { component } = createComponent();
      const tools = component.toolSet;
      expect(tools.has('checkInbox')).toBe(true);
      expect(tools.has('acknowledgeTask')).toBe(true);
      expect(tools.has('completeTask')).toBe(true);
      expect(tools.has('failTask')).toBe(true);
    });

    it('should include coordinator tools when no lineage', () => {
      const { component } = createComponent();
      const tools = component.toolSet;
      expect(tools.has('sendTask')).toBe(true);
      expect(tools.has('sendQuery')).toBe(true);
      expect(tools.has('checkSent')).toBe(true);
      expect(tools.has('waitForResult')).toBe(true);
      expect(tools.has('cancelTask')).toBe(true);
      expect(tools.has('createAgentByType')).toBe(true);
      expect(tools.has('startAgent')).toBe(true);
      expect(tools.has('stopAgent')).toBe(true);
      expect(tools.has('destroyAgent')).toBe(true);
      expect(tools.has('listChildAgents')).toBe(true);
      expect(tools.has('listAllowedSouls')).toBe(true);
      expect(tools.has('getMyInfo')).toBe(true);
      expect(tools.has('getStats')).toBe(true);
      expect(tools.has('discoverAgents')).toBe(true);
    });

    it('should include coordinator tools for coordinator role', () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });
      const tools = component.toolSet;
      expect(tools.has('sendTask')).toBe(true);
      expect(tools.has('createAgentByType')).toBe(true);
    });

    it('should not include discoverAgents for coordinator role', () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });
      expect(component.toolSet.has('discoverAgents')).toBe(false);
    });

    it('should not include coordinator tools for worker role', () => {
      const { component } = createComponent({
        lineage: createLineage('worker'),
      });
      const tools = component.toolSet;
      expect(tools.has('sendTask')).toBe(false);
      expect(tools.has('sendQuery')).toBe(false);
      expect(tools.has('checkSent')).toBe(false);
      expect(tools.has('waitForResult')).toBe(false);
      expect(tools.has('cancelTask')).toBe(false);
      expect(tools.has('createAgentByType')).toBe(false);
      expect(tools.has('startAgent')).toBe(false);
      expect(tools.has('stopAgent')).toBe(false);
      expect(tools.has('destroyAgent')).toBe(false);
      expect(tools.has('listChildAgents')).toBe(false);
      expect(tools.has('listAllowedSouls')).toBe(false);
      expect(tools.has('getMyInfo')).toBe(false);
      expect(tools.has('getStats')).toBe(false);
      expect(tools.has('discoverAgents')).toBe(false);
    });

    it('should have descriptions for all tools', () => {
      const { component } = createComponent();
      for (const [name, tool] of component.toolSet) {
        expect(tool.desc).toBeDefined();
        expect(tool.desc.length).toBeGreaterThan(0);
        expect(tool.toolName).toBe(name);
      }
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('unknownTool', {});
      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.data.error).toContain('Unknown tool');
    });
  });

  // ===========================================================================
  // INBOX
  // ===========================================================================

  describe('onCheckInbox', () => {
    it('should return empty inbox when no pending tasks', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('checkInbox', {});
      expect(result.success).toBe(true);
      expect(result.data.pending).toEqual([]);
      expect(result.data.acknowledged).toEqual([]);
      expect(result.data.completed).toEqual([]);
      expect(result.data.failed).toEqual([]);
      expect(result.data.total).toBe(0);
    });

    it('should populate incoming tasks from handler', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        messageType: 'task',
        from: 'sender-agent',
        payload: {
          taskId: 'task-1',
          description: 'Do something',
          input: {},
          metadata: { priority: 'high' },
        },
        receivedAt: Date.now(),
        acknowledged: false,
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      const result = await component.handleToolCall('checkInbox', {});

      expect(result.success).toBe(true);
      expect(result.data.pending).toHaveLength(1);
      expect(result.data.pending[0].conversationId).toBe('conv-1');
      expect(result.data.pending[0].from).toBe('sender-agent');
      expect(result.data.pending[0].description).toBe('Do something');
      expect(result.data.pending[0].priority).toBe('high');
      expect(result.data.pending[0].status).toBe('pending');
      expect(result.data.total).toBe(1);
    });

    it('should not duplicate tasks on subsequent calls', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        messageType: 'task',
        from: 'sender-agent',
        payload: { taskId: 'task-1', description: 'Do something', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      await component.handleToolCall('checkInbox', {});
      const result2 = await component.handleToolCall('checkInbox', {});
      expect(result2.data.total).toBe(1);
    });

    it('should mark acknowledged tasks', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-2',
        messageId: 'msg-2',
        messageType: 'task',
        from: 'sender-agent',
        payload: { taskId: 'task-2', description: 'Task 2', input: {} },
        receivedAt: Date.now(),
        acknowledged: true,
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      const result = await component.handleToolCall('checkInbox', {});
      expect(result.data.acknowledged).toHaveLength(1);
      expect(result.data.pending).toHaveLength(0);
    });

    it('should use taskId as description fallback', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-3',
        messageId: 'msg-3',
        messageType: 'task',
        from: 'sender-agent',
        payload: { taskId: 'fallback-task-id', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      const result = await component.handleToolCall('checkInbox', {});
      expect(result.data.pending[0].description).toBe('fallback-task-id');
    });

    it('should default priority to normal', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-4',
        messageId: 'msg-4',
        messageType: 'task',
        from: 'sender-agent',
        payload: { description: 'Task 4', input: {}, metadata: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      const result = await component.handleToolCall('checkInbox', {});
      expect(result.data.pending[0].priority).toBe('normal');
    });

    it('should handle errors', async () => {
      const { component, a2aHandler } = createComponent();
      vi.mocked(a2aHandler.getPendingTasks).mockImplementation(() => {
        throw new Error('handler error');
      });

      const result = await component.handleToolCall('checkInbox', {});
      expect(result.success).toBe(false);
      expect(result.data.error).toBe('handler error');
    });
  });

  describe('onAcknowledgeTask', () => {
    it('should acknowledge a pending task', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-ack',
        messageId: 'msg-ack',
        messageType: 'task',
        from: 'sender-agent',
        payload: { description: 'Ack task', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      await component.handleToolCall('checkInbox', {});

      const result = await component.handleToolCall('acknowledgeTask', {
        conversationId: 'conv-ack',
      });
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(a2aHandler.acknowledge).toHaveBeenCalledWith('conv-ack');
    });

    it('should handle acknowledge errors', async () => {
      const { component, a2aHandler } = createComponent();
      vi.mocked(a2aHandler.acknowledge).mockRejectedValue(
        new Error('ack failed'),
      );

      const result = await component.handleToolCall('acknowledgeTask', {
        conversationId: 'conv-err',
      });
      expect(result.success).toBe(false);
      expect(result.data.error).toBe('ack failed');
    });
  });

  describe('onCompleteTask', () => {
    it('should complete a task', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-done',
        messageId: 'msg-done',
        messageType: 'task',
        from: 'sender-agent',
        payload: { description: 'Done task', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      await component.handleToolCall('checkInbox', {});

      const result = await component.handleToolCall('completeTask', {
        conversationId: 'conv-done',
        output: { result: '42' },
      });
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(a2aHandler.completeTask).toHaveBeenCalledWith(
        'conv-done',
        { result: '42' },
        'completed',
      );
    });

    it('should handle complete errors', async () => {
      const { component, a2aHandler } = createComponent();
      vi.mocked(a2aHandler.completeTask).mockImplementation(() => {
        throw new Error('complete failed');
      });

      const result = await component.handleToolCall('completeTask', {
        conversationId: 'conv-err',
        output: {},
      });
      expect(result.success).toBe(false);
      expect(result.data.error).toBe('complete failed');
    });
  });

  describe('onFailTask', () => {
    it('should fail a task', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-fail',
        messageId: 'msg-fail',
        messageType: 'task',
        from: 'sender-agent',
        payload: { description: 'Fail task', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      await component.handleToolCall('checkInbox', {});

      const result = await component.handleToolCall('failTask', {
        conversationId: 'conv-fail',
        error: 'Something went wrong',
      });
      expect(result.success).toBe(true);
      expect(a2aHandler.completeTask).toHaveBeenCalledWith(
        'conv-fail',
        { error: 'Something went wrong' },
        'failed',
      );
    });
  });

  // ===========================================================================
  // SENT (coordinator)
  // ===========================================================================

  describe('onSendTask', () => {
    it('should send a task and track it', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue(
        'conv-sent-1',
      );

      const result = await component.handleToolCall('sendTask', {
        targetAgentId: 'child-agent-1',
        taskId: 'task-sent-1',
        description: 'Analyze data',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.conversationId).toBe('conv-sent-1');
      expect(result.data.taskId).toBe('task-sent-1');
      expect(result.data.status).toBe('in-flight');
      expect(a2aClient.sendTaskAndWaitForAck).toHaveBeenCalledWith(
        'child-agent-1',
        'task-sent-1',
        'Analyze data',
        {},
        { priority: 'normal' },
      );
    });

    it('should pass priority option', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue('conv-high');

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-agent-1',
        taskId: 'task-high',
        description: 'Urgent task',
        priority: 'high',
      });

      expect(a2aClient.sendTaskAndWaitForAck).toHaveBeenCalledWith(
        'child-agent-1',
        'task-high',
        'Urgent task',
        {},
        { priority: 'high' },
      );
    });

    it('should handle send errors', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockRejectedValue(
        new Error('send failed'),
      );

      const result = await component.handleToolCall('sendTask', {
        targetAgentId: 'child-agent-1',
        taskId: 'task-err',
        description: 'Fail task',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('send failed');
    });
  });

  describe('onSendQuery', () => {
    it('should send a query and return response', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendQuery).mockResolvedValue({ answer: 42 });

      const result = await component.handleToolCall('sendQuery', {
        targetAgentId: 'child-agent-1',
        query: 'What is 6*7?',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.from).toBe('child-agent-1');
      expect(result.data.output).toEqual({ answer: 42 });
    });

    it('should handle query errors', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendQuery).mockRejectedValue(
        new Error('query failed'),
      );

      const result = await component.handleToolCall('sendQuery', {
        targetAgentId: 'child-agent-1',
        query: 'fail',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('query failed');
    });
  });

  describe('onCheckSent', () => {
    it('should return empty sent tasks', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('checkSent', {});

      expect(result.success).toBe(true);
      expect(result.data.tasks).toEqual([]);
      expect(result.data.inFlightCount).toBe(0);
      expect(result.data.completedCount).toBe(0);
      expect(result.data.failedCount).toBe(0);
    });

    it('should track sent tasks', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue('conv-1');
      vi.mocked(a2aClient.waitForResult).mockImplementation(
        () => new Promise(() => {}),
      );

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-1',
        taskId: 'task-1',
        description: 'First',
      });
      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-2',
        taskId: 'task-2',
        description: 'Second',
      });

      const result = await component.handleToolCall('checkSent', {});
      expect(result.data.tasks).toHaveLength(2);
      expect(result.data.inFlightCount).toBe(2);
    });
  });

  describe('onWaitForResult', () => {
    it('should return error when task not found', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('waitForResult', {
        conversationId: 'nonexistent',
      });
      expect(result.success).toBe(false);
      expect(result.data.error).toContain('No sent task found');
    });

    it('should return immediately for completed task', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue('conv-c');
      vi.mocked(a2aClient.waitForResult).mockImplementation(
        () => new Promise(() => {}),
      );

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-1',
        taskId: 'task-c',
        description: 'Wait task',
      });

      (component as any).reactive.sentTasks['task-c'] = {
        ...(component as any).snapshot.sentTasks['task-c'],
        status: 'completed',
        resultSummary: 'done!',
        completedAt: Date.now(),
      };

      const result = await component.handleToolCall('waitForResult', {
        conversationId: 'conv-c',
      });
      expect(result.success).toBe(true);
      expect(result.data.resultSummary).toBe('done!');
    });

    it('should return error for failed task', async () => {
      const { component, a2aClient, sleepControl } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue('conv-f');
      vi.mocked(a2aClient.waitForResult).mockRejectedValue(
        new Error('Task failed'),
      );
      vi.mocked(sleepControl.isSleeping).mockReturnValue(true);

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-1',
        taskId: 'task-f',
        description: 'Fail wait',
      });

      const result = await component.handleToolCall('waitForResult', {
        conversationId: 'conv-f',
      });

      expect(result.success).toBe(false);
      expect(sleepControl.wakeUp).toHaveBeenCalled();
    });
  });

  describe('onCancelTask', () => {
    it('should return error when task not found', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('cancelTask', {
        conversationId: 'nonexistent',
      });
      expect(result.success).toBe(false);
    });

    it('should return error when task not in-flight', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('cancelTask', {
        conversationId: 'nonexistent',
      });
      expect(result.success).toBe(false);
    });

    it('should cancel an in-flight task', async () => {
      const { component, a2aClient } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue(
        'conv-cancel',
      );
      vi.mocked(a2aClient.waitForResult).mockImplementation(
        () => new Promise(() => {}),
      );

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-1',
        taskId: 'task-cancel',
        description: 'Cancel me',
      });

      const result = await component.handleToolCall('cancelTask', {
        conversationId: 'conv-cancel',
      });

      expect(result.success).toBe(true);
      expect(a2aClient.sendCancel).toHaveBeenCalledWith(
        'child-1',
        'task-cancel',
        'conv-cancel',
      );
    });

    it('should wake up sleep control on cancel', async () => {
      const { component, a2aClient, sleepControl } = createComponent();
      vi.mocked(a2aClient.sendTaskAndWaitForAck).mockResolvedValue('conv-wake');
      vi.mocked(sleepControl.isSleeping).mockReturnValue(true);

      await component.handleToolCall('sendTask', {
        targetAgentId: 'child-1',
        taskId: 'task-wake',
        description: 'Wake cancel',
      });

      await component.handleToolCall('cancelTask', {
        conversationId: 'conv-wake',
      });

      expect(sleepControl.wakeUp).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // LIFECYCLE (coordinator)
  // ===========================================================================

  describe('lifecycle - no runtime client', () => {
    it('should return noClient error for listChildAgents', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('listChildAgents', {});
      expect(result.success).toBe(false);
      expect(result.data.error).toContain(
        'Runtime control client not available',
      );
    });

    it('should return noClient error for createAgentByType', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('createAgentByType', {
        soulToken: 'worker-a',
      });
      expect(result.success).toBe(false);
      expect(result.data.error).toContain(
        'Runtime control client not available',
      );
    });

    it('should return noClient error for startAgent', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('startAgent', {
        agentId: 'agent-1',
      });
      expect(result.success).toBe(false);
    });

    it('should return noClient error for stopAgent', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('stopAgent', {
        agentId: 'agent-1',
      });
      expect(result.success).toBe(false);
    });

    it('should return noClient error for destroyAgent', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('destroyAgent', {
        agentId: 'agent-1',
      });
      expect(result.success).toBe(false);
    });

    it('should return noClient error for getStats', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('getStats', {});
      expect(result.success).toBe(false);
    });
  });

  describe('lifecycle - with runtime client', () => {
    it('should list child agents', async () => {
      const mockClient = createMockRuntimeClient();
      vi.mocked(mockClient.listChildAgents).mockResolvedValue([
        {
          instanceId: 'child-1',
          alias: 'c1',
          name: 'Child One',
          status: AgentStatus.Running,
          agentType: 'worker-a',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('listChildAgents', {});
      expect(result.success).toBe(true);
      expect(result.data.agents).toHaveLength(1);
      expect(result.data.agents[0].instanceId).toBe('child-1');
      expect(result.data.agents[0].name).toBe('Child One');
    });

    it('should create agent by type', async () => {
      const mockClient = createMockRuntimeClient();
      vi.mocked(mockClient.createAgent).mockResolvedValue('new-inst-123');
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('createAgentByType', {
        soulToken: 'worker-a',
        name: 'My Worker',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.instanceId).toBe('new-inst-123');
      expect(result.data.name).toBe('My Worker');
      expect(result.data.soulToken).toBe('worker-a');
      expect(mockClient.createAgent).toHaveBeenCalledWith({
        agent: { type: 'worker-a', name: 'My Worker' },
      });
    });

    it('should use soulToken as name when name not provided', async () => {
      const mockClient = createMockRuntimeClient();
      vi.mocked(mockClient.createAgent).mockResolvedValue('new-inst-456');
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('createAgentByType', {
        soulToken: 'worker-b',
      });

      expect(result.data.name).toBe('worker-b');
    });

    it('should start agent', async () => {
      const mockClient = createMockRuntimeClient();
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('startAgent', {
        agentId: 'child-1',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockClient.startAgent).toHaveBeenCalledWith('child-1');
    });

    it('should stop agent', async () => {
      const mockClient = createMockRuntimeClient();
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('stopAgent', {
        agentId: 'child-1',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockClient.stopAgent).toHaveBeenCalledWith('child-1');
    });

    it('should destroy agent', async () => {
      const mockClient = createMockRuntimeClient();
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('destroyAgent', {
        agentId: 'child-1',
        cascade: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockClient.destroyAgent).toHaveBeenCalledWith('child-1', {
        cascade: true,
      });
    });

    it('should handle lifecycle errors', async () => {
      const mockClient = createMockRuntimeClient();
      vi.mocked(mockClient.startAgent).mockRejectedValue(
        new Error('already running'),
      );
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('startAgent', {
        agentId: 'child-1',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('already running');
    });

    it('should get stats', async () => {
      const mockClient = createMockRuntimeClient();
      const { component } = createComponent({ runtimeClient: mockClient });

      const result = await component.handleToolCall('getStats', {});

      expect(result.success).toBe(true);
      expect(result.data.totalAgents).toBe(5);
    });
  });

  // ===========================================================================
  // DISCOVERY
  // ===========================================================================

  describe('onListAllowedSouls', () => {
    it('should list allowed souls from lineage', async () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });

      const result = await component.handleToolCall('listAllowedSouls', {});

      expect(result.success).toBe(true);
      expect(result.data.souls).toHaveLength(1);
      expect(result.data.souls[0].soulToken).toBe('worker-a');
    });

    it('should work without lineage', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('listAllowedSouls', {});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.souls)).toBe(true);
    });
  });

  describe('onGetMyInfo', () => {
    it('should return instance info without lineage', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('getMyInfo', {});

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe(INSTANCE_ID);
      expect(result.data.role).toBeUndefined();
      expect(result.data.allowedChildren).toEqual([]);
    });

    it('should return instance info with lineage', async () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
        runtimeClient: createMockRuntimeClient(),
      });

      const result = await component.handleToolCall('getMyInfo', {});

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe(INSTANCE_ID);
      expect(result.data.role).toBe('coordinator');
      expect(result.data.schemaId).toBe('test-schema');
      expect(result.data.soulToken).toBe('node-1');
      expect(result.data.allowedChildren).toHaveLength(1);
      expect(result.data.parentInstanceId).toBe('parent-abc');
    });
  });

  describe('onDiscoverAgents', () => {
    it('should discover all agents', async () => {
      const { component } = createComponent();
      const result = await component.handleToolCall('discoverAgents', {});

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(0);
      expect(result.data.agents).toEqual([]);
    });

    it('should handle discover agents errors', async () => {
      const { component } = createComponent();
      const registry = getGlobalAgentRegistry();
      const origGetAll = registry.getAllAgents.bind(registry);
      registry.getAllAgents = () => {
        throw new Error('registry error');
      };

      const result = await component.handleToolCall('discoverAgents', {});

      expect(result.success).toBe(false);
      expect((result.data as Record<string, unknown>).error).toBe(
        'registry error',
      );

      registry.getAllAgents = origGetAll;
    });
  });

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  describe('exportData', () => {
    it('should export initial state', async () => {
      const { component } = createComponent();
      const result = await component.exportData();
      const data = result.data as Record<string, unknown>;

      expect(result.format).toBe('json');
      expect(data.instanceId).toBe(INSTANCE_ID);
      expect(data.sentTasks).toEqual([]);
      expect(data.incomingTasks).toEqual([]);
      expect(data.childAgents).toEqual([]);
      expect(data.inFlightCount).toBe(0);
      expect(data.completedCount).toBe(0);
      expect(data.failedCount).toBe(0);
      expect(data.inboxPendingCount).toBe(0);
      expect(data.inboxProcessingCount).toBe(0);
    });

    it('should export state with lineage', async () => {
      const { component } = createComponent({
        lineage: createLineage('coordinator'),
      });
      const result = await component.exportData();
      const data = result.data as Record<string, unknown>;

      expect(data.lineage).toBeDefined();
      expect((data.lineage as AgentLineageInfo).role).toBe('coordinator');
    });
  });

  // ===========================================================================
  // RENDER
  // ===========================================================================

  describe('renderImply', () => {
    it('should render with no activity', async () => {
      const { component } = createComponent();
      const elements = await component.renderImply();

      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should render inbox section when tasks exist', async () => {
      const { component, a2aHandler } = createComponent();
      const pendingTask: PendingTask = {
        conversationId: 'conv-r1',
        messageId: 'msg-r1',
        messageType: 'task',
        from: 'sender-agent',
        payload: { description: 'Render task', input: {} },
        receivedAt: Date.now(),
      };
      vi.mocked(a2aHandler.getPendingTasks).mockReturnValue([pendingTask]);

      await component.handleToolCall('checkInbox', {});
      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(2);
    });
  });
});
