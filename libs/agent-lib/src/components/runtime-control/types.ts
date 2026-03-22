/**
 * RuntimeControlComponent - Types
 */

import type { IRuntimeControlClient } from '../../core/runtime/types.js';

/**
 * Configuration for RuntimeControlComponent
 */
export interface RuntimeControlComponentConfig {
  /** This agent's instance ID */
  instanceId: string;

  /**
   * Callback to get the RuntimeControlClient
   * This is called at runtime since the client is set after agent creation
   */
  getRuntimeClient?: () => IRuntimeControlClient | undefined;
}
