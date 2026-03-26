/**
 * Runtime Control Component
 *
 * Provides tools for Agent creation and management.
 *
 * - RuntimeControlComponent: DI-based, uses injected RuntimeControlClient (in-process)
 * - RuntimeControlRESTComponent: REST-based, communicates with swarm server via HTTP
 */

// DI-based component (in-process)
export { RuntimeControlComponent } from './RuntimeControlComponent.js';
export { RuntimeControlState } from './types.js';
export type { RuntimeControlComponentConfig } from './types.js';

// REST-based component (cross-process)
export { RuntimeControlRESTComponent } from './RuntimeControlRESTComponent.js';
export type { RuntimeControlRESTConfig } from './RuntimeControlRESTComponent.js';

export * from './schemas.js';
