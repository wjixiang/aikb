/**
 * Agent Session Manager
 *
 * Handles session lifecycle persistence operations for the Agent.
 * Stateless design - receives state as parameters from Agent.
 *
 * Note: Instance-level data (component states, memory) is managed separately
 * by the Agent class and MemoryModule respectively.
 */

import { injectable, inject, optional } from 'inversify';
import pino from 'pino';

import { TYPES } from '../di/types.js';
import type { IPersistenceService } from '../persistence/types.js';
import type { ISessionManager } from './ISessionManager.js';
import type { SessionState } from './types.js';

@injectable()
export class AgentSessionManager implements ISessionManager {
  constructor(
    @inject(TYPES.AgentInstanceId) private instanceId: string,
    @inject(TYPES.IPersistenceService)
    @optional()
    private persistenceService?: IPersistenceService,
    @inject(TYPES.Logger)
    @optional()
    private logger?: pino.Logger,
  ) {
    this.logger =
      logger ?? pino({ level: process.env['LOG_LEVEL'] || 'debug' });
  }

  async createSession(state: SessionState): Promise<void> {
    if (!this.persistenceService) return;

    try {
      await this.persistenceService.createSession({
        instanceId: state.instanceId,
        status: state.status,
        totalTokensIn: state.tokenUsage.totalTokensIn,
        totalTokensOut: state.tokenUsage.totalTokensOut,
        totalCost: state.tokenUsage.totalCost,
        consecutiveMistakeCount: state.consecutiveMistakeCount,
        collectedErrors: state.collectedErrors,
      });
    } catch (error) {
      this.logger?.error(
        { error },
        '[AgentSessionManager] Failed to create session',
      );
    }
  }

  async persistState(state: SessionState): Promise<void> {
    if (!this.persistenceService) return;

    try {
      await this.persistenceService.updateSession(state.instanceId, {
        status: state.status,
        abortReason: state.abortInfo?.reason,
        abortSource: state.abortInfo?.source,
        totalTokensIn: state.tokenUsage.totalTokensIn,
        totalTokensOut: state.tokenUsage.totalTokensOut,
        totalCost: state.tokenUsage.totalCost,
        toolUsage: state.toolUsage,
        consecutiveMistakeCount: state.consecutiveMistakeCount,
        collectedErrors: state.collectedErrors,
      });
    } catch (error) {
      this.logger?.error(
        { error, instanceId: state.instanceId },
        '[AgentSessionManager] Failed to persist state',
      );
    }
  }

  async endSession(state: SessionState, reason?: string): Promise<void> {
    if (!this.persistenceService) {
      this.logger?.warn(
        '[AgentSessionManager] No persistence service, skipping endSession',
      );
      return;
    }

    const finalStatus = reason === 'aborted' ? 'aborted' : 'completed';

    try {
      await this.persistenceService.updateSession(state.instanceId, {
        status: finalStatus,
        abortReason: reason,
        abortSource: 'system',
        totalTokensIn: state.tokenUsage.totalTokensIn,
        totalTokensOut: state.tokenUsage.totalTokensOut,
        totalCost: state.tokenUsage.totalCost,
        toolUsage: state.toolUsage,
        consecutiveMistakeCount: state.consecutiveMistakeCount,
        collectedErrors: state.collectedErrors,
      });

      await this.persistenceService.updateInstanceMetadata(state.instanceId, {
        status: finalStatus,
      });

      this.logger?.info(
        { instanceId: state.instanceId, status: finalStatus },
        '[AgentSessionManager] Session ended',
      );
    } catch (error) {
      this.logger?.error(
        { error, instanceId: state.instanceId },
        '[AgentSessionManager] Failed to end session',
      );
    }
  }
}
