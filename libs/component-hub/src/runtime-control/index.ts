/**
 * Runtime Control Component
 *
 * Provides tools for Agent creation and management.
 *
 * - RuntimeControlComponent: Hybrid (DI for agent lifecycle, REST for topology)
 * - SwarmAPIClient: Low-level REST client for swarm server
 */

export { RuntimeControlComponent } from './RuntimeControlComponent.js';
export { SwarmAPIClient } from './restClient.js';
export type { RuntimeControlRESTConfig as RESTConfig } from './restClient.js';

export * from './schemas.js';
