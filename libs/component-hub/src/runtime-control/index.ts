/**
 * Runtime Control Component
 *
 * Provides tools for Agent creation and management.
 *
 * - RuntimeControlComponent: DI-based, uses injected RuntimeControlClient (in-process)
 * - RuntimeControlRESTComponent: REST-based, communicates with swarm server via HTTP
 */

export { RuntimeControlComponent } from './RuntimeControlComponent.js';
export { RuntimeControlRESTComponent } from './RuntimeControlRESTComponent.js';
export type { RuntimeControlRESTConfig } from './RuntimeControlRESTComponent.js';

export * from './schemas.js';
