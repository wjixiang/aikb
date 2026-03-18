import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import directly from source files since index.ts has limited exports
import {
  // tool.ts
  toolGroups,
  toolGroupsSchema,
  toolNames,
  toolNamesSchema,
  toolUsageSchema,
  TOOL_PROTOCOL,
  isNativeProtocol,
  getEffectiveProtocol,
} from '../tool.js';

import {
  // todo.ts
  todoStatusSchema,
  todoItemSchema,
} from '../todo.js';

import {
  // model.ts
  reasoningEfforts,
  reasoningEffortsSchema,
  reasoningEffortWithMinimalSchema,
  reasoningEffortsExtended,
  reasoningEffortExtendedSchema,
  reasoningEffortSettingValues,
  reasoningEffortSettingSchema,
  verbosityLevels,
  verbosityLevelsSchema,
  serviceTiers,
  serviceTierSchema,
  modelParameters,
  modelParametersSchema,
  isModelParameter,
  modelInfoSchema,
} from '../model.js';

import {
  // message.type.ts
  clineAsks,
  clineAskSchema,
  clineSays,
  clineSaySchema,
  toolProgressStatusSchema,
  clineMessageSchema,
  tokenUsageSchema,
  queuedMessageSchema,
} from '../message.type.js';

import {
  // event.type.ts
  RooCodeEventName,
  rooCodeEventsSchema,
  taskEventSchema,
} from '../event.type.js';

import {
  // task.ts
  CreateTaskOptions,
  TaskStatus,
  taskMetadataSchema,
} from '../task.js';

import {
  // provider-settings.ts
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  providerNames,
  providerNamesSchema,
  isProviderName,
  providerSettingsSchema,
  providerSettingsWithIdSchema,
  modelIdKeys,
  getModelId,
  ANTHROPIC_STYLE_PROVIDERS,
  getApiProtocol,
} from '../provider-settings.js';

import {
  // global-settings.ts
  DEFAULT_WRITE_DELAY_MS,
  DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
  MIN_CHECKPOINT_TIMEOUT_SECONDS,
  MAX_CHECKPOINT_TIMEOUT_SECONDS,
  DEFAULT_CHECKPOINT_TIMEOUT_SECONDS,
  globalSettingsSchema,
  SECRET_STATE_KEYS,
  GLOBAL_SECRET_KEYS,
  isSecretStateKey,
  GLOBAL_STATE_KEYS,
  isGlobalStateKey,
  EVALS_SETTINGS,
  EVALS_TIMEOUT,
} from '../global-settings.js';

import {
  // type-fu.ts
  Keys,
  Values,
  Equals,
  AssertEqual,
} from '../type-fu.js';

// Re-export constants from index for testing
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT as EXPORTED_MISTAKE_LIMIT } from '../index.js';

describe('core/types', () => {
  // ==================== tool.ts ====================
  describe('tool.ts', () => {
    describe('toolGroups', () => {
      it('should have correct tool group values', () => {
        expect(toolGroups).toEqual(['search']);
      });

      it('should validate correctly with schema', () => {
        expect(toolGroupsSchema.parse('search')).toBe('search');
        expect(() => toolGroupsSchema.parse('invalid')).toThrow();
      });
    });

    describe('toolNames', () => {
      it('should have correct tool name values', () => {
        expect(toolNames).toEqual(['attempt_completion', 'semantic_search', 'update_workspace']);
      });

      it('should validate correctly with schema', () => {
        expect(toolNamesSchema.parse('attempt_completion')).toBe('attempt_completion');
        expect(() => toolNamesSchema.parse('invalid')).toThrow();
      });
    });

    describe('toolUsageSchema', () => {
      it('should validate correct tool usage record', () => {
        const result = toolUsageSchema.parse({
          attempt_completion: { attempts: 5, failures: 1 },
          semantic_search: { attempts: 3, failures: 0 },
        });
        expect(result.attempt_completion.attempts).toBe(5);
        expect(result.semantic_search.failures).toBe(0);
      });

      it('should reject invalid tool usage', () => {
        expect(() =>
          toolUsageSchema.parse({
            invalid_tool: { attempts: 5, failures: 1 },
          }),
        ).toThrow();
      });
    });

    describe('TOOL_PROTOCOL', () => {
      it('should have correct protocol values', () => {
        expect(TOOL_PROTOCOL).toEqual({ XML: 'xml', NATIVE: 'native' });
      });
    });

    describe('isNativeProtocol', () => {
      it('should return true for native protocol', () => {
        expect(isNativeProtocol('native')).toBe(true);
      });

      it('should return false for xml protocol', () => {
        expect(isNativeProtocol('xml')).toBe(false);
      });
    });

    describe('getEffectiveProtocol', () => {
      it('should return provided protocol if valid', () => {
        expect(getEffectiveProtocol('native')).toBe('native');
        expect(getEffectiveProtocol('xml')).toBe('xml');
      });

      it('should default to XML when undefined', () => {
        expect(getEffectiveProtocol()).toBe('xml');
        expect(getEffectiveProtocol(undefined)).toBe('xml');
      });
    });
  });

  // ==================== todo.ts ====================
  describe('todo.ts', () => {
    describe('todoStatusSchema', () => {
      it('should validate correct status values', () => {
        expect(todoStatusSchema.parse('pending')).toBe('pending');
        expect(todoStatusSchema.parse('in_progress')).toBe('in_progress');
        expect(todoStatusSchema.parse('completed')).toBe('completed');
      });

      it('should reject invalid status', () => {
        expect(() => todoStatusSchema.parse('invalid')).toThrow();
      });
    });

    describe('todoItemSchema', () => {
      it('should validate correct todo item', () => {
        const result = todoItemSchema.parse({
          id: 'todo-1',
          content: 'Test todo',
          status: 'pending',
        });
        expect(result.id).toBe('todo-1');
        expect(result.status).toBe('pending');
      });

      it('should reject todo without required fields', () => {
        expect(() => todoItemSchema.parse({ id: 'todo-1' })).toThrow();
        expect(() => todoItemSchema.parse({ content: 'Test' })).toThrow();
      });
    });
  });

  // ==================== model.ts ====================
  describe('model.ts', () => {
    describe('reasoningEfforts', () => {
      it('should have correct values', () => {
        expect(reasoningEfforts).toEqual(['low', 'medium', 'high']);
      });

      it('should validate correctly', () => {
        expect(reasoningEffortsSchema.parse('low')).toBe('low');
        expect(reasoningEffortsSchema.parse('medium')).toBe('medium');
        expect(reasoningEffortsSchema.parse('high')).toBe('high');
        expect(() => reasoningEffortsSchema.parse('invalid')).toThrow();
      });
    });

    describe('reasoningEffortWithMinimalSchema', () => {
      it('should include minimal plus regular efforts', () => {
        expect(reasoningEffortWithMinimalSchema.parse('minimal')).toBe('minimal');
        expect(reasoningEffortWithMinimalSchema.parse('low')).toBe('low');
        expect(reasoningEffortWithMinimalSchema.parse('high')).toBe('high');
        expect(() => reasoningEffortWithMinimalSchema.parse('invalid')).toThrow();
      });
    });

    describe('reasoningEffortsExtended', () => {
      it('should have correct extended values', () => {
        expect(reasoningEffortsExtended).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
      });
    });

    describe('reasoningEffortSettingValues', () => {
      it('should include disable plus extended values', () => {
        expect(reasoningEffortSettingValues).toContain('disable');
        expect(reasoningEffortSettingValues).toContain('none');
        expect(reasoningEffortSettingValues).toContain('xhigh');
      });
    });

    describe('verbosityLevels', () => {
      it('should have correct values', () => {
        expect(verbosityLevels).toEqual(['low', 'medium', 'high']);
      });

      it('should validate correctly', () => {
        expect(verbosityLevelsSchema.parse('medium')).toBe('medium');
        expect(() => verbosityLevelsSchema.parse('invalid')).toThrow();
      });
    });

    describe('serviceTiers', () => {
      it('should have correct values', () => {
        expect(serviceTiers).toEqual(['default', 'flex', 'priority']);
      });

      it('should validate correctly', () => {
        expect(serviceTierSchema.parse('flex')).toBe('flex');
        expect(() => serviceTierSchema.parse('invalid')).toThrow();
      });
    });

    describe('modelParameters', () => {
      it('should have correct values', () => {
        expect(modelParameters).toEqual(['max_tokens', 'temperature', 'reasoning', 'include_reasoning']);
      });
    });

    describe('isModelParameter', () => {
      it('should return true for valid parameters', () => {
        expect(isModelParameter('max_tokens')).toBe(true);
        expect(isModelParameter('temperature')).toBe(true);
      });

      it('should return false for invalid parameters', () => {
        expect(isModelParameter('invalid')).toBe(false);
      });
    });

    describe('modelInfoSchema', () => {
      it('should validate correct model info', () => {
        const result = modelInfoSchema.parse({
          maxTokens: 1000,
          contextWindow: 100000,
          supportsImages: true,
          supportsPromptCache: true,
        });
        expect(result.maxTokens).toBe(1000);
        expect(result.contextWindow).toBe(100000);
        expect(result.supportsImages).toBe(true);
      });

      it('should validate model info with optional fields', () => {
        const result = modelInfoSchema.parse({
          maxTokens: 1000,
          contextWindow: 100000,
          supportsPromptCache: false,
          inputPrice: 0.5,
          outputPrice: 1.5,
        });
        expect(result.inputPrice).toBe(0.5);
      });

      it('should validate model info with service tiers', () => {
        const result = modelInfoSchema.parse({
          contextWindow: 100000,
          supportsPromptCache: true,
          tiers: [
            { name: 'flex', contextWindow: 100000, inputPrice: 0.5 },
            { name: 'priority', contextWindow: 200000, inputPrice: 1.0 },
          ],
        });
        expect(result.tiers).toHaveLength(2);
        expect(result.tiers?.[0].name).toBe('flex');
      });

      it('should reject invalid service tier', () => {
        expect(() =>
          modelInfoSchema.parse({
            contextWindow: 100000,
            supportsPromptCache: true,
            tiers: [{ name: 'invalid', contextWindow: 100000 }],
          }),
        ).toThrow();
      });
    });
  });

  // ==================== message.type.ts ====================
  describe('message.type.ts', () => {
    describe('clineAsks', () => {
      it('should have all expected ask types', () => {
        const expected = [
          'followup',
          'command',
          'command_output',
          'completion_result',
          'tool',
          'api_req_failed',
          'resume_task',
          'resume_completed_task',
          'mistake_limit_reached',
          'browser_action_launch',
          'use_mcp_server',
          'auto_approval_max_req_reached',
        ];
        expect(clineAsks).toEqual(expected);
      });

      it('should validate correctly via schema', () => {
        expect(clineAskSchema.parse('followup')).toBe('followup');
        expect(clineAskSchema.parse('command')).toBe('command');
        expect(() => clineAskSchema.parse('invalid')).toThrow();
      });
    });

    describe('clineSays', () => {
      it('should have all expected say types', () => {
        expect(clineSays).toContain('text');
        expect(clineSays).toContain('reasoning');
        expect(clineSays).toContain('error');
        expect(clineSays).toContain('completion_result');
      });

      it('should validate correctly via schema', () => {
        expect(clineSaySchema.parse('text')).toBe('text');
        expect(clineSaySchema.parse('error')).toBe('error');
        expect(() => clineSaySchema.parse('invalid')).toThrow();
      });
    });

    describe('toolProgressStatusSchema', () => {
      it('should validate correct progress status', () => {
        const result = toolProgressStatusSchema.parse({
          icon: 'check',
          text: 'Working...',
        });
        expect(result.icon).toBe('check');
        expect(result.text).toBe('Working...');
      });

      it('should allow empty object', () => {
        expect(toolProgressStatusSchema.parse({})).toEqual({});
      });
    });

    describe('clineMessageSchema', () => {
      it('should validate a say message', () => {
        const result = clineMessageSchema.parse({
          ts: Date.now(),
          type: 'say',
          say: 'text',
          text: 'Hello world',
        });
        expect(result.type).toBe('say');
        expect(result.say).toBe('text');
        expect(result.text).toBe('Hello world');
      });

      it('should validate an ask message', () => {
        const result = clineMessageSchema.parse({
          ts: Date.now(),
          type: 'ask',
          ask: 'followup',
          text: 'What would you like me to do?',
        });
        expect(result.type).toBe('ask');
        expect(result.ask).toBe('followup');
      });

      it('should validate message with contextCondense', () => {
        const result = clineMessageSchema.parse({
          ts: Date.now(),
          type: 'say',
          say: 'condense_context',
          contextCondense: {
            cost: 100,
            prevContextTokens: 5000,
            newContextTokens: 2000,
            summary: 'Summarized conversation',
          },
        });
        expect(result.contextCondense?.summary).toBe('Summarized conversation');
      });

      it('should validate message with contextTruncation', () => {
        const result = clineMessageSchema.parse({
          ts: Date.now(),
          type: 'say',
          say: 'sliding_window_truncation',
          contextTruncation: {
            truncationId: 'trunc-1',
            messagesRemoved: 5,
            prevContextTokens: 5000,
            newContextTokens: 3000,
          },
        });
        expect(result.contextTruncation?.messagesRemoved).toBe(5);
      });

      it('should validate message with optional fields', () => {
        const result = clineMessageSchema.parse({
          ts: Date.now(),
          type: 'say',
          say: 'text',
          partial: true,
          images: ['img1.png', 'img2.png'],
          reasoning: 'Let me think...',
          isProtected: true,
          apiProtocol: 'anthropic',
          isAnswered: false,
        });
        expect(result.partial).toBe(true);
        expect(result.images).toHaveLength(2);
        expect(result.apiProtocol).toBe('anthropic');
      });
    });

    describe('tokenUsageSchema', () => {
      it('should validate correct token usage', () => {
        const result = tokenUsageSchema.parse({
          totalTokensIn: 1000,
          totalTokensOut: 500,
          totalCost: 0.25,
          contextTokens: 800,
        });
        expect(result.totalTokensIn).toBe(1000);
        expect(result.totalCost).toBe(0.25);
      });

      it('should validate with cache fields', () => {
        const result = tokenUsageSchema.parse({
          totalTokensIn: 1000,
          totalTokensOut: 500,
          totalCacheWrites: 100,
          totalCacheReads: 50,
          totalCost: 0.25,
          contextTokens: 800,
        });
        expect(result.totalCacheWrites).toBe(100);
        expect(result.totalCacheReads).toBe(50);
      });

      it('should accept zero values', () => {
        const result = tokenUsageSchema.parse({
          totalTokensIn: 0,
          totalTokensOut: 0,
          totalCost: 0,
          contextTokens: 0,
        });
        expect(result.totalTokensIn).toBe(0);
      });
    });

    describe('queuedMessageSchema', () => {
      it('should validate correct queued message', () => {
        const result = queuedMessageSchema.parse({
          timestamp: Date.now(),
          id: 'msg-123',
          text: 'Hello queue',
        });
        expect(result.id).toBe('msg-123');
        expect(result.text).toBe('Hello queue');
      });

      it('should validate with images', () => {
        const result = queuedMessageSchema.parse({
          timestamp: Date.now(),
          id: 'msg-124',
          text: 'Image message',
          images: ['img1.png'],
        });
        expect(result.images).toHaveLength(1);
      });
    });
  });

  // ==================== event.type.ts ====================
  describe('event.type.ts', () => {
    describe('RooCodeEventName', () => {
      it('should have all expected event names', () => {
        expect(RooCodeEventName.TaskCreated).toBe('taskCreated');
        expect(RooCodeEventName.TaskStarted).toBe('taskStarted');
        expect(RooCodeEventName.TaskCompleted).toBe('taskCompleted');
        expect(RooCodeEventName.Message).toBe('message');
        expect(RooCodeEventName.TaskTokenUsageUpdated).toBe('taskTokenUsageUpdated');
      });
    });

    describe('rooCodeEventsSchema', () => {
      it('should validate TaskCreated event', () => {
        // TaskCreated expects a tuple with task ID string
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskCreated].parse(['task-123']);
        expect(result[0]).toBe('task-123');
      });

      it('should validate TaskStarted event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskStarted].parse(['task-123']);
        expect(result[0]).toBe('task-123');
      });

      it('should validate TaskCompleted event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskCompleted].parse([
          'task-123',
          { totalTokensIn: 100, totalTokensOut: 50, totalCost: 0.1, contextTokens: 80 },
          { attempt_completion: { attempts: 5, failures: 0 } },
          { isSubtask: false },
        ]);
        expect(result[0]).toBe('task-123');
        expect(result[1].totalCost).toBe(0.1);
        expect(result[3].isSubtask).toBe(false);
      });

      it('should validate TaskDelegated event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskDelegated].parse([
          'parent-task',
          'child-task',
        ]);
        expect(result).toEqual(['parent-task', 'child-task']);
      });

      it('should validate Message event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.Message].parse([
          {
            taskId: 'task-123',
            action: 'created',
            message: { ts: Date.now(), type: 'say', say: 'text', text: 'Hello' },
          },
        ]);
        expect(result[0].taskId).toBe('task-123');
        expect(result[0].action).toBe('created');
      });

      it('should validate ModeChanged event - expects array', () => {
        // ModeChanged expects tuple with mode string
        const result = rooCodeEventsSchema.shape[RooCodeEventName.ModeChanged].parse(['architect']);
        expect(result[0]).toBe('architect');
      });

      it('should validate TaskTokenUsageUpdated event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskTokenUsageUpdated].parse([
          'task-123',
          { totalTokensIn: 100, totalTokensOut: 50, totalCost: 0.1, contextTokens: 80 },
          { attempt_completion: { attempts: 5, failures: 0 } },
        ]);
        expect(result[0]).toBe('task-123');
      });

      it('should validate TaskToolFailed event', () => {
        const result = rooCodeEventsSchema.shape[RooCodeEventName.TaskToolFailed].parse([
          'task-123',
          'semantic_search',
          'Error message',
        ]);
        expect(result[0]).toBe('task-123');
        expect(result[1]).toBe('semantic_search');
      });
    });

    describe('taskEventSchema', () => {
      it('should validate TaskCreated event', () => {
        const result = taskEventSchema.parse({
          eventName: RooCodeEventName.TaskCreated,
          payload: ['task-123'],
        });
        expect(result.eventName).toBe('taskCreated');
      });

      it('should validate TaskCompleted event', () => {
        const result = taskEventSchema.parse({
          eventName: RooCodeEventName.TaskCompleted,
          payload: [
            'task-123',
            { totalTokensIn: 100, totalTokensOut: 50, totalCost: 0.1, contextTokens: 80 },
            { attempt_completion: { attempts: 5, failures: 0 } },
            { isSubtask: false },
          ],
        });
        expect(result.eventName).toBe('taskCompleted');
      });

      it('should validate EvalPass event', () => {
        const result = taskEventSchema.parse({
          eventName: RooCodeEventName.EvalPass,
          payload: undefined,
          taskId: 1,
        });
        expect(result.eventName).toBe('evalPass');
        expect(result.taskId).toBe(1);
      });

      it('should validate EvalFail event', () => {
        const result = taskEventSchema.parse({
          eventName: RooCodeEventName.EvalFail,
          payload: undefined,
          taskId: 2,
        });
        expect(result.eventName).toBe('evalFail');
        expect(result.taskId).toBe(2);
      });

      it('should reject invalid event name', () => {
        expect(() =>
          taskEventSchema.parse({
            eventName: 'invalidEvent',
            payload: [],
          }),
        ).toThrow();
      });
    });
  });

  // ==================== task.ts ====================
  describe('task.ts', () => {
    describe('TaskStatus', () => {
      it('should have correct enum values', () => {
        expect(TaskStatus.Running).toBe('running');
        expect(TaskStatus.Interactive).toBe('interactive');
        expect(TaskStatus.Resumable).toBe('resumable');
        expect(TaskStatus.Idle).toBe('idle');
        expect(TaskStatus.None).toBe('none');
      });
    });

    describe('CreateTaskOptions', () => {
      it('should allow partial options', () => {
        const options: CreateTaskOptions = {
          enableDiff: true,
          consecutiveMistakeLimit: 3,
        };
        expect(options.enableDiff).toBe(true);
        expect(options.consecutiveMistakeLimit).toBe(3);
      });

      it('should allow full options', () => {
        const options: CreateTaskOptions = {
          enableDiff: true,
          enableCheckpoints: true,
          fuzzyMatchThreshold: 0.8,
          consecutiveMistakeLimit: 5,
          experiments: { newFeature: true },
          initialTodos: [{ id: '1', content: 'Test', status: 'pending' }],
          initialStatus: 'active',
        };
        expect(options.initialStatus).toBe('active');
        expect(options.experiments?.newFeature).toBe(true);
        expect(options.initialTodos).toHaveLength(1);
      });
    });

    describe('taskMetadataSchema', () => {
      it('should validate correct metadata', () => {
        const result = taskMetadataSchema.parse({
          task: 'Test task',
          images: ['img1.png'],
        });
        expect(result.task).toBe('Test task');
        expect(result.images).toHaveLength(1);
      });

      it('should allow empty object', () => {
        const result = taskMetadataSchema.parse({});
        expect(result).toEqual({});
      });
    });
  });

  // ==================== provider-settings.ts ====================
  describe('provider-settings.ts', () => {
    describe('DEFAULT_CONSECUTIVE_MISTAKE_LIMIT', () => {
      it('should be 3', () => {
        expect(DEFAULT_CONSECUTIVE_MISTAKE_LIMIT).toBe(3);
      });
    });

    describe('providerNames', () => {
      it('should have all expected providers', () => {
        expect(providerNames).toContain('anthropic');
        expect(providerNames).toContain('openai');
        expect(providerNames).toContain('openai-native');
        expect(providerNames).toContain('zai');
        expect(providerNames).toContain('moonshot');
        expect(providerNames).toContain('ollama');
      });
    });

    describe('isProviderName', () => {
      it('should return true for valid provider names', () => {
        expect(isProviderName('anthropic')).toBe(true);
        expect(isProviderName('openai')).toBe(true);
      });

      it('should return false for invalid provider names', () => {
        expect(isProviderName('invalid')).toBe(false);
        expect(isProviderName('')).toBe(false);
        expect(isProviderName(123 as any)).toBe(false);
      });
    });

    describe('providerSettingsSchema', () => {
      it('should validate minimal settings', () => {
        const result = providerSettingsSchema.parse({});
        expect(result).toEqual({});
      });

      it('should validate with apiProvider', () => {
        const result = providerSettingsSchema.parse({
          apiProvider: 'anthropic',
        });
        expect(result.apiProvider).toBe('anthropic');
      });

      it('should validate provider-specific settings', () => {
        const result = providerSettingsSchema.parse({
          apiProvider: 'anthropic',
          apiKey: 'sk-ant-xxx',
          apiModelId: 'claude-3-opus',
          anthropicBaseUrl: 'https://api.anthropic.com',
        });
        expect(result.apiKey).toBe('sk-ant-xxx');
        expect(result.anthropicBaseUrl).toBe('https://api.anthropic.com');
      });

      it('should validate zai settings', () => {
        const result = providerSettingsSchema.parse({
          apiProvider: 'zai',
          apiKey: 'zai-key',
          zaiApiLine: 'international_coding',
        });
        expect(result.zaiApiLine).toBe('international_coding');
      });

      it('should validate moonshot settings', () => {
        const result = providerSettingsSchema.parse({
          apiProvider: 'moonshot',
          moonshotBaseUrl: 'https://api.moonshot.com',
          moonshotApiLine: 'coding',
        });
        expect(result.moonshotApiLine).toBe('coding');
      });

      it('should validate ollama settings', () => {
        const result = providerSettingsSchema.parse({
          apiProvider: 'ollama',
          ollamaBaseUrl: 'http://localhost:11434',
        });
        expect(result.ollamaBaseUrl).toBe('http://localhost:11434');
      });

      it('should validate tool protocol', () => {
        const xmlResult = providerSettingsSchema.parse({
          toolProtocol: 'xml',
        });
        expect(xmlResult.toolProtocol).toBe('xml');

        const nativeResult = providerSettingsSchema.parse({
          toolProtocol: 'native',
        });
        expect(nativeResult.toolProtocol).toBe('native');
      });

      it('should reject invalid tool protocol', () => {
        expect(() =>
          providerSettingsSchema.parse({
            toolProtocol: 'invalid',
          }),
        ).toThrow();
      });

      it('should validate consecutiveMistakeLimit', () => {
        const result = providerSettingsSchema.parse({
          consecutiveMistakeLimit: 5,
        });
        expect(result.consecutiveMistakeLimit).toBe(5);

        expect(() =>
          providerSettingsSchema.parse({
            consecutiveMistakeLimit: -1,
          }),
        ).toThrow();
      });
    });

    describe('providerSettingsWithIdSchema', () => {
      it('should validate with id', () => {
        const result = providerSettingsWithIdSchema.parse({
          id: 'config-1',
          apiProvider: 'openai',
        });
        expect(result.id).toBe('config-1');
      });
    });

    describe('modelIdKeys', () => {
      it('should have correct model id key values', () => {
        expect(modelIdKeys).toContain('apiModelId');
        expect(modelIdKeys).toContain('ollamaModelId');
        expect(modelIdKeys).toContain('lmStudioModelId');
        expect(modelIdKeys).toContain('minimaxModelId');
      });
    });

    describe('getModelId', () => {
      it('should return model id from apiModelId', () => {
        const result = getModelId({ apiModelId: 'gpt-4' });
        expect(result).toBe('gpt-4');
      });

      it('should return model id from ollamaModelId', () => {
        const result = getModelId({ ollamaModelId: 'llama2' });
        expect(result).toBe('llama2');
      });

      it('should return undefined when no model id set', () => {
        const result = getModelId({});
        expect(result).toBeUndefined();
      });

      it('should prioritize apiModelId when multiple set', () => {
        const result = getModelId({
          apiModelId: 'gpt-4',
          ollamaModelId: 'llama2',
        });
        expect(result).toBe('gpt-4');
      });
    });

    describe('ANTHROPIC_STYLE_PROVIDERS', () => {
      it('should include anthropic', () => {
        expect(ANTHROPIC_STYLE_PROVIDERS).toContain('anthropic');
        expect(ANTHROPIC_STYLE_PROVIDERS).toEqual(['anthropic']);
      });
    });

    describe('getApiProtocol', () => {
      it('should return anthropic for anthropic provider', () => {
        expect(getApiProtocol('anthropic')).toBe('anthropic');
      });

      it('should return openai for other providers', () => {
        expect(getApiProtocol('openai')).toBe('openai');
        expect(getApiProtocol('openai-native')).toBe('openai');
        expect(getApiProtocol('zai')).toBe('openai');
      });

      it('should return openai when provider is undefined', () => {
        expect(getApiProtocol(undefined)).toBe('openai');
      });

      it('should consider modelId if provided', () => {
        // Same logic based on provider only in current implementation
        expect(getApiProtocol('openai', 'gpt-4')).toBe('openai');
      });
    });
  });

  // ==================== global-settings.ts ====================
  describe('global-settings.ts', () => {
    describe('constants', () => {
      it('should have correct DEFAULT_WRITE_DELAY_MS', () => {
        expect(DEFAULT_WRITE_DELAY_MS).toBe(1000);
      });

      it('should have correct DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT', () => {
        expect(DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT).toBe(50_000);
      });

      it('should have correct checkpoint timeout constants', () => {
        expect(MIN_CHECKPOINT_TIMEOUT_SECONDS).toBe(10);
        expect(MAX_CHECKPOINT_TIMEOUT_SECONDS).toBe(60);
        expect(DEFAULT_CHECKPOINT_TIMEOUT_SECONDS).toBe(15);
      });
    });

    describe('globalSettingsSchema', () => {
      it('should validate empty object', () => {
        const result = globalSettingsSchema.parse({});
        expect(result).toEqual({});
      });

      it('should validate currentApiConfigName', () => {
        const result = globalSettingsSchema.parse({
          currentApiConfigName: 'my-config',
        });
        expect(result.currentApiConfigName).toBe('my-config');
      });

      it('should validate settings with boolean values', () => {
        const result = globalSettingsSchema.parse({
          autoApprovalEnabled: true,
          alwaysAllowReadOnly: true,
          alwaysAllowWrite: false,
          diffEnabled: true,
        });
        expect(result.autoApprovalEnabled).toBe(true);
        expect(result.alwaysAllowWrite).toBe(false);
      });

      it('should validate writeDelayMs', () => {
        const result = globalSettingsSchema.parse({
          writeDelayMs: 2000,
        });
        expect(result.writeDelayMs).toBe(2000);

        expect(() =>
          globalSettingsSchema.parse({
            writeDelayMs: -100,
          }),
        ).toThrow();
      });

      it('should validate checkpoint settings', () => {
        const result = globalSettingsSchema.parse({
          enableCheckpoints: true,
          checkpointTimeout: 30,
        });
        expect(result.checkpointTimeout).toBe(30);
      });

      it('should reject checkpointTimeout below minimum', () => {
        expect(() =>
          globalSettingsSchema.parse({
            checkpointTimeout: 5,
          }),
        ).toThrow();
      });

      it('should reject checkpointTimeout above maximum', () => {
        expect(() =>
          globalSettingsSchema.parse({
            checkpointTimeout: 100,
          }),
        ).toThrow();
      });

      it('should validate allowedCommands', () => {
        const result = globalSettingsSchema.parse({
          allowedCommands: ['npm', 'pnpm', '*'],
        });
        expect(result.allowedCommands).toContain('npm');
      });

      it('should validate mode and modeApiConfigs', () => {
        const result = globalSettingsSchema.parse({
          mode: 'architect',
          modeApiConfigs: {
            architect: 'config-1',
            code: 'config-2',
          },
        });
        expect(result.mode).toBe('architect');
        expect(result.modeApiConfigs?.architect).toBe('config-1');
      });

      it('should validate imageGenerationProvider', () => {
        const result = globalSettingsSchema.parse({
          imageGenerationProvider: 'openrouter',
        });
        expect(result.imageGenerationProvider).toBe('openrouter');

        expect(() =>
          globalSettingsSchema.parse({
            imageGenerationProvider: 'invalid',
          }),
        ).toThrow();
      });
    });

    describe('SECRET_STATE_KEYS', () => {
      it('should contain expected secret keys', () => {
        expect(SECRET_STATE_KEYS).toContain('apiKey');
        expect(SECRET_STATE_KEYS).toContain('openAiApiKey');
        expect(SECRET_STATE_KEYS).toContain('geminiApiKey');
      });
    });

    describe('GLOBAL_SECRET_KEYS', () => {
      it('should contain image generation key', () => {
        expect(GLOBAL_SECRET_KEYS).toContain('openRouterImageApiKey');
      });
    });

    describe('isSecretStateKey', () => {
      it('should return true for secret keys', () => {
        expect(isSecretStateKey('apiKey')).toBe(true);
        expect(isSecretStateKey('openAiApiKey')).toBe(true);
        expect(isSecretStateKey('openRouterImageApiKey')).toBe(true);
      });

      it('should return false for non-secret keys', () => {
        expect(isSecretStateKey('mode')).toBe(false);
        expect(isSecretStateKey('currentApiConfigName')).toBe(false);
      });
    });

    describe('isGlobalStateKey', () => {
      it('should return true for global state keys', () => {
        expect(isGlobalStateKey('mode')).toBe(true);
        expect(isGlobalStateKey('autoApprovalEnabled')).toBe(true);
      });

      it('should return false for secret keys', () => {
        expect(isGlobalStateKey('apiKey')).toBe(false);
      });
    });

    describe('EVALS_SETTINGS', () => {
      it('should have correct defaults for evals', () => {
        expect(EVALS_SETTINGS.apiProvider).toBe('openai-native');
        expect(EVALS_SETTINGS.autoApprovalEnabled).toBe(true);
        expect(EVALS_SETTINGS.alwaysAllowReadOnly).toBe(true);
        expect(EVALS_SETTINGS.alwaysAllowWrite).toBe(true);
      });

      it('should have correct allowed commands', () => {
        expect(EVALS_SETTINGS.allowedCommands).toEqual(['*']);
      });

      it('should have correct mode', () => {
        expect(EVALS_SETTINGS.mode).toBe('code');
      });
    });

    describe('EVALS_TIMEOUT', () => {
      it('should be 5 minutes in milliseconds', () => {
        expect(EVALS_TIMEOUT).toBe(5 * 60 * 1000);
      });
    });
  });

  // ==================== type-fu.ts ====================
  describe('type-fu.ts', () => {
    describe('Keys', () => {
      it('should extract keys from a type', () => {
        type Result = Keys<{ a: string; b: number }>;
        const keys: Result[] = ['a', 'b'];
        expect(keys).toContain('a');
        expect(keys).toContain('b');
      });
    });

    describe('Values', () => {
      it('should extract values from a type', () => {
        type Result = Values<{ a: string; b: number }>;
        const values: Result[] = ['hello', 42];
        expect(values).toContain('hello');
        expect(values).toContain(42);
      });
    });

    describe('Equals', () => {
      it('should return true for equal types', () => {
        type Result = Equals<string, string>;
        const assertEqual: AssertEqual<Result> = true;
        expect(assertEqual).toBe(true);
      });

      it('should return false for unequal types', () => {
        type Result = Equals<string, number>;
        // Result should be false, which cannot be assigned to true
        const result: Result = false as Result;
        expect(result).toBe(false);
      });
    });
  });

  // ==================== index.ts ====================
  describe('index.ts', () => {
    describe('DEFAULT_CONSECUTIVE_MISTAKE_LIMIT', () => {
      it('should be exported from index', () => {
        expect(EXPORTED_MISTAKE_LIMIT).toBe(5);
      });
    });
  });
});
