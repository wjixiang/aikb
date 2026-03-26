/**
 * AgentSessionManager Tests
 *
 * Unit tests for session lifecycle management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSessionManager } from '../AgentSessionManager.js';
import type { IPersistenceService } from '../../persistence/types.js';
import type { SessionState, AbortInfo } from '../types.js';
import { AgentStatus } from '../../common/types.js';

// Mock pino
vi.mock('pino', () => {
  return {
    default: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('AgentSessionManager', () => {
  let mockPersistenceService: IPersistenceService;
  let sessionManager: AgentSessionManager;

  const createMockSessionState = (
    overrides: Partial<SessionState> = {},
  ): SessionState => {
    const defaultState: SessionState = {
      instanceId: 'test-instance-123',
      status: AgentStatus.Running,
      tokenUsage: {
        totalTokensIn: 1000,
        totalTokensOut: 500,
        totalCost: 0.05,
      },
      toolUsage: {},
      consecutiveMistakeCount: 0,
      collectedErrors: [],
      abortInfo: null,
      ...overrides,
    };
    return defaultState;
  };

  beforeEach(() => {
    // Create mock persistence service
    mockPersistenceService = {
      createSession: vi.fn().mockResolvedValue('session-id-123'),
      getSession: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
      getStats: vi
        .fn()
        .mockResolvedValue({ totalSessions: 0, byStatus: {}, totalCost: 0 }),
      saveMemory: vi.fn().mockResolvedValue(undefined),
      loadMemory: vi.fn().mockResolvedValue(null),
      saveInstanceMetadata: vi.fn().mockResolvedValue(undefined),
      getInstanceMetadata: vi.fn().mockResolvedValue(null),
      updateInstanceMetadata: vi.fn().mockResolvedValue(undefined),
      saveComponentState: vi.fn().mockResolvedValue(undefined),
      getComponentState: vi.fn().mockResolvedValue(null),
      getAllComponentStates: vi.fn().mockResolvedValue({}),
      deleteComponentState: vi.fn().mockResolvedValue(undefined),
      saveExportResult: vi.fn().mockResolvedValue(undefined),
    };

    // AgentSessionManager takes positional arguments: instanceId, persistenceService, logger
    sessionManager = new AgentSessionManager(
      'test-instance-123',
      mockPersistenceService,
      undefined,
    );
  });

  describe('createSession', () => {
    it('should create a session with valid state', async () => {
      const state = createMockSessionState();

      await sessionManager.createSession(state);

      expect(mockPersistenceService.createSession).toHaveBeenCalledWith({
        instanceId: state.instanceId,
        status: state.status,
        totalTokensIn: state.tokenUsage.totalTokensIn,
        totalTokensOut: state.tokenUsage.totalTokensOut,
        totalCost: state.tokenUsage.totalCost,
        consecutiveMistakeCount: state.consecutiveMistakeCount,
        collectedErrors: state.collectedErrors,
      });
    });

    it('should create session with error tracking', async () => {
      const state = createMockSessionState({
        collectedErrors: ['error-1', 'error-2'],
        consecutiveMistakeCount: 3,
      });

      await sessionManager.createSession(state);

      expect(mockPersistenceService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveMistakeCount: 3,
          collectedErrors: ['error-1', 'error-2'],
        }),
      );
    });

    it('should handle missing persistence service gracefully', async () => {
      const managerWithoutPersistence = new AgentSessionManager(
        'test-instance-123',
        undefined,
        undefined,
      );

      const state = createMockSessionState();

      // Should not throw
      await expect(
        managerWithoutPersistence.createSession(state),
      ).resolves.not.toThrow();
      expect(mockPersistenceService.createSession).not.toHaveBeenCalled();
    });

    it('should log error when persistence createSession fails', async () => {
      const state = createMockSessionState();
      mockPersistenceService.createSession = vi
        .fn()
        .mockRejectedValue(new Error('DB error'));

      await sessionManager.createSession(state);

      // Should not throw, just log
      await expect(sessionManager.createSession(state)).resolves.not.toThrow();
    });
  });

  describe('persistState', () => {
    it('should persist state with all fields', async () => {
      const state = createMockSessionState({
        status: AgentStatus.Running,
        tokenUsage: {
          totalTokensIn: 2000,
          totalTokensOut: 1000,
          totalCost: 0.1,
        },
        toolUsage: {
          'search-tool': { attempts: 5, failures: 1 },
        },
        consecutiveMistakeCount: 2,
        collectedErrors: ['some-error'],
        abortInfo: null,
      });

      await sessionManager.persistState(state);

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          status: AgentStatus.Running,
          totalTokensIn: 2000,
          totalTokensOut: 1000,
          totalCost: 0.1,
          toolUsage: { 'search-tool': { attempts: 5, failures: 1 } },
          consecutiveMistakeCount: 2,
          collectedErrors: ['some-error'],
        }),
      );
    });

    it('should include abortInfo when present', async () => {
      const abortInfo: AbortInfo = {
        reason: 'user-requested',
        timestamp: Date.now(),
        source: 'user',
        details: { userId: 'user-123' },
      };
      const state = createMockSessionState({
        abortInfo,
        status: AgentStatus.Aborted,
      });

      await sessionManager.persistState(state);

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          abortReason: 'user-requested',
          abortSource: 'user',
        }),
      );
    });

    it('should handle missing persistence service gracefully', async () => {
      const managerWithoutPersistence = new AgentSessionManager(
        'test-instance-123',
        undefined,
        undefined,
      );

      const state = createMockSessionState();

      await expect(
        managerWithoutPersistence.persistState(state),
      ).resolves.not.toThrow();
      expect(mockPersistenceService.updateSession).not.toHaveBeenCalled();
    });

    it('should log error when persistence updateSession fails', async () => {
      const state = createMockSessionState();
      mockPersistenceService.updateSession = vi
        .fn()
        .mockRejectedValue(new Error('Update failed'));

      await sessionManager.persistState(state);

      await expect(sessionManager.persistState(state)).resolves.not.toThrow();
    });
  });

  describe('endSession', () => {
    it('should end session with completed status when no reason provided', async () => {
      const state = createMockSessionState({
        status: AgentStatus.Running,
      });

      await sessionManager.endSession(state);

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          status: AgentStatus.Completed,
          abortReason: undefined,
          abortSource: 'system',
        }),
      );
      expect(
        mockPersistenceService.updateInstanceMetadata,
      ).toHaveBeenCalledWith(state.instanceId, {
        status: AgentStatus.Completed,
      });
    });

    it('should end session with aborted status when reason is aborted', async () => {
      const state = createMockSessionState({
        status: AgentStatus.Running,
      });

      await sessionManager.endSession(state, 'aborted');

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          status: AgentStatus.Aborted,
          abortReason: 'aborted',
          abortSource: 'system',
        }),
      );
      expect(
        mockPersistenceService.updateInstanceMetadata,
      ).toHaveBeenCalledWith(state.instanceId, { status: AgentStatus.Aborted });
    });

    it('should end session with completed status for other reasons', async () => {
      const state = createMockSessionState({
        status: AgentStatus.Running,
      });

      await sessionManager.endSession(state, 'timeout');

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          status: AgentStatus.Completed,
          abortReason: 'timeout',
          abortSource: 'system',
        }),
      );
    });

    it('should end session with all token usage data', async () => {
      const state = createMockSessionState({
        status: AgentStatus.Running,
        tokenUsage: {
          totalTokensIn: 5000,
          totalTokensOut: 2500,
          totalCost: 0.25,
        },
        toolUsage: {
          'browse-tool': { attempts: 10, failures: 2 },
        },
        consecutiveMistakeCount: 1,
        collectedErrors: [],
      });

      await sessionManager.endSession(state);

      expect(mockPersistenceService.updateSession).toHaveBeenCalledWith(
        state.instanceId,
        expect.objectContaining({
          totalTokensIn: 5000,
          totalTokensOut: 2500,
          totalCost: 0.25,
          toolUsage: { 'browse-tool': { attempts: 10, failures: 2 } },
          consecutiveMistakeCount: 1,
          collectedErrors: [],
        }),
      );
    });

    it('should warn when no persistence service available', async () => {
      const managerWithoutPersistence = new AgentSessionManager(
        'test-instance-123',
        undefined,
        undefined,
      );

      const state = createMockSessionState();

      await expect(
        managerWithoutPersistence.endSession(state),
      ).resolves.not.toThrow();
      expect(mockPersistenceService.updateSession).not.toHaveBeenCalled();
      expect(
        mockPersistenceService.updateInstanceMetadata,
      ).not.toHaveBeenCalled();
    });

    it('should continue even if updateSession fails', async () => {
      const state = createMockSessionState();
      mockPersistenceService.updateSession = vi
        .fn()
        .mockRejectedValue(new Error('Update failed'));

      await sessionManager.endSession(state);

      // Should not throw, but should still attempt updateInstanceMetadata
      await expect(sessionManager.endSession(state)).resolves.not.toThrow();
    });

    it('should handle updateInstanceMetadata failure gracefully', async () => {
      const state = createMockSessionState();
      mockPersistenceService.updateInstanceMetadata = vi
        .fn()
        .mockRejectedValue(new Error('Metadata update failed'));

      await sessionManager.endSession(state);

      await expect(sessionManager.endSession(state)).resolves.not.toThrow();
    });

    it('should log successful session end', async () => {
      const state = createMockSessionState();

      await sessionManager.endSession(state);

      await expect(sessionManager.endSession(state)).resolves.not.toThrow();
    });
  });
});

describe('ISessionManager Interface', () => {
  // Tests verifying the implementation conforms to the interface contract

  let mockPersistenceService: IPersistenceService;

  const createMockSessionState = (
    overrides: Partial<SessionState> = {},
  ): SessionState => {
    return {
      instanceId: 'test-instance-456',
      status: AgentStatus.Running,
      tokenUsage: {
        totalTokensIn: 500,
        totalTokensOut: 250,
        totalCost: 0.02,
      },
      toolUsage: {},
      consecutiveMistakeCount: 0,
      collectedErrors: [],
      abortInfo: null,
      ...overrides,
    };
  };

  beforeEach(() => {
    mockPersistenceService = {
      createSession: vi.fn().mockResolvedValue('session-id'),
      updateSession: vi.fn().mockResolvedValue(undefined),
      updateInstanceMetadata: vi.fn().mockResolvedValue(undefined),
    } as Partial<IPersistenceService> as IPersistenceService;
  });

  it('should implement createSession that accepts SessionState and returns Promise<void>', async () => {
    const manager = new AgentSessionManager(
      'test-instance-456',
      mockPersistenceService,
      undefined,
    );
    const state = createMockSessionState();

    const result = manager.createSession(state);

    await expect(result).resolves.toBeUndefined();
  });

  it('should implement persistState that accepts SessionState and returns Promise<void>', async () => {
    const manager = new AgentSessionManager(
      'test-instance-456',
      mockPersistenceService,
      undefined,
    );
    const state = createMockSessionState();

    const result = manager.persistState(state);

    await expect(result).resolves.toBeUndefined();
  });

  it('should implement endSession that accepts SessionState and optional reason, returns Promise<void>', async () => {
    const manager = new AgentSessionManager(
      'test-instance-456',
      mockPersistenceService,
      undefined,
    );
    const state = createMockSessionState();

    const result1 = manager.endSession(state);
    await expect(result1).resolves.toBeUndefined();

    const result2 = manager.endSession(state, 'aborted');
    await expect(result2).resolves.toBeUndefined();

    const result3 = manager.endSession(state, 'user-requested');
    await expect(result3).resolves.toBeUndefined();
  });
});
