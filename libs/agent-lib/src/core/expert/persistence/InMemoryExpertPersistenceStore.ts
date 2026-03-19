/**
 * In-Memory Expert Persistence Store
 *
 * Fallback implementation when no database is available
 * Does not persist across restarts
 */

import type { ExpertInstanceState, IExpertPersistenceStore } from './ExpertPersistenceStore.js';

export class InMemoryExpertPersistenceStore implements IExpertPersistenceStore {
  private instances: Map<string, ExpertInstanceState> = new Map();

  private getKey(expertClassId: string, instanceId: string): string {
    return `${expertClassId}/${instanceId}`;
  }

  async saveInstance(state: ExpertInstanceState): Promise<void> {
    const key = this.getKey(state.expertClassId, state.instanceId);
    this.instances.set(key, { ...state });
  }

  async loadInstance(expertClassId: string, instanceId: string): Promise<ExpertInstanceState | null> {
    const key = this.getKey(expertClassId, instanceId);
    const state = this.instances.get(key);
    return state ? { ...state } : null;
  }

  async listInstances(expertClassId?: string): Promise<ExpertInstanceState[]> {
    const states: ExpertInstanceState[] = [];
    for (const state of this.instances.values()) {
      if (!expertClassId || state.expertClassId === expertClassId) {
        states.push({ ...state });
      }
    }
    return states;
  }

  async deleteInstance(expertClassId: string, instanceId: string): Promise<void> {
    const key = this.getKey(expertClassId, instanceId);
    this.instances.delete(key);
  }

  async listRunningInstances(): Promise<ExpertInstanceState[]> {
    const states: ExpertInstanceState[] = [];
    for (const state of this.instances.values()) {
      if (state.status === 'running') {
        states.push({ ...state });
      }
    }
    return states;
  }

  async saveResult(expertClassId: string, instanceId: string, resultData: Record<string, unknown>): Promise<void> {
    const key = this.getKey(expertClassId, instanceId);
    const state = this.instances.get(key);
    if (state) {
      state.resultData = resultData;
    }
  }
}