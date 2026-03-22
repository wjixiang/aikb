/**
 * RuntimeControl Component
 *
 * Provides tools for Agent creation and management through RuntimeControlClient.
 *
 * @example
 * ```typescript
 * import { RuntimeControlComponent } from 'agent-lib/components/runtime-control';
 *
 * const component = new RuntimeControlComponent({
 *   instanceId: 'my-agent-id',
 *   getRuntimeClient: () => runtimeClient,
 * });
 * ```
 */

export { RuntimeControlComponent } from './RuntimeControlComponent.js';
export type { RuntimeControlComponentConfig } from './types.js';
export * from './schemas.js';
