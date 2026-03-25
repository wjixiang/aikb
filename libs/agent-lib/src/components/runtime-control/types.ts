/**
 * RuntimeControlComponent - Types
 */

import type { IRuntimeControlClient } from '../../core/runtime/types.js';

/**
 * Shared state for RuntimeControlComponent and Agent
 * This allows Agent to set the runtimeClient and the component to read it
 */
export class RuntimeControlState {
  private _runtimeClient?: IRuntimeControlClient;

  setRuntimeClient(client: IRuntimeControlClient): void {
    this._runtimeClient = client;
  }

  getRuntimeClient(): IRuntimeControlClient | undefined {
    return this._runtimeClient;
  }
}

/**
 * Configuration for RuntimeControlComponent
 */
export interface RuntimeControlComponentConfig {
  /** This agent's instance ID */
  instanceId: string;

  /**
   * Shared state for accessing runtimeClient
   * Agent sets it via setRuntimeClient(), component reads it
   */
  state?: RuntimeControlState;

  /**
   * Callback to get the RuntimeControlClient (deprecated, use state instead)
   */
  getRuntimeClient?: () => IRuntimeControlClient | undefined;
}
