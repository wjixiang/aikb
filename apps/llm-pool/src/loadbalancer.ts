/**
 * LLM Pool - Load Balancer
 *
 * Manages backend selection and request routing
 */

import pino from 'pino';
import { BackendConfig, LoadBalancingStrategy } from './config.js';
import { BackendStatus as BackendStatusType } from './types.js';

export interface BackendState {
  config: BackendConfig;
  status: BackendStatusType;
  roundRobinIndex: number;
}

export class LoadBalancer {
  private backends: Map<string, BackendState> = new Map();
  private strategy: LoadBalancingStrategy;
  private logger: pino.Logger;

  constructor(strategy: LoadBalancingStrategy, logger: pino.Logger) {
    this.strategy = strategy;
    this.logger = logger.child({ component: 'LoadBalancer' });
  }

  /**
   * Register a backend
   */
  registerBackend(config: BackendConfig): void {
    const state: BackendState = {
      config,
      status: {
        id: config.id,
        healthy: true,
        currentRequests: 0,
        totalRequests: 0,
        failedRequests: 0,
        avgLatency: 0,
        lastRequestTime: null,
        lastError: null,
      },
      roundRobinIndex: 0,
    };
    this.backends.set(config.id, state);
    this.logger.info({ backendId: config.id, model: config.model }, 'Backend registered');
  }

  /**
   * Remove a backend
   */
  removeBackend(id: string): void {
    this.backends.delete(id);
    this.logger.info({ backendId: id }, 'Backend removed');
  }

  /**
   * Update backend configuration
   */
  updateBackend(config: BackendConfig): void {
    const state = this.backends.get(config.id);
    if (state) {
      state.config = config;
      this.logger.info({ backendId: config.id }, 'Backend updated');
    }
  }

  /**
   * Get the best backend based on the selected strategy
   */
  selectBackend(enabledBackendIds: string[]): BackendState | null {
    const enabledBackends = Array.from(this.backends.values()).filter(
      (b) => b.config.enabled && enabledBackendIds.includes(b.config.id) && b.status.healthy
    );

    if (enabledBackends.length === 0) {
      this.logger.error({ enabledBackendIds }, 'No healthy backends available');
      return null;
    }

    let selected: BackendState;

    switch (this.strategy) {
      case 'round-robin':
        selected = this.selectRoundRobin(enabledBackends);
        break;
      case 'weighted':
        selected = this.selectWeighted(enabledBackends);
        break;
      case 'least-loaded':
        selected = this.selectLeastLoaded(enabledBackends);
        break;
      case 'random':
        selected = this.selectRandom(enabledBackends);
        break;
      case 'failover':
        selected = this.selectFailover(enabledBackends);
        break;
      default:
        selected = this.selectWeighted(enabledBackends);
    }

    this.logger.debug(
      { backendId: selected.config.id, strategy: this.strategy },
      'Backend selected'
    );
    return selected;
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(backends: BackendState[]): BackendState {
    const idx = backends[0].roundRobinIndex % backends.length;
    const backend = backends[idx];
    backend.roundRobinIndex++;
    return backend;
  }

  /**
   * Weighted random selection
   */
  private selectWeighted(backends: BackendState[]): BackendState {
    const totalWeight = backends.reduce((sum, b) => sum + b.config.weight, 0);
    let random = Math.random() * totalWeight;

    for (const backend of backends) {
      random -= backend.config.weight;
      if (random <= 0) {
        return backend;
      }
    }

    return backends[backends.length - 1];
  }

  /**
   * Select the backend with the least current requests
   */
  private selectLeastLoaded(backends: BackendState[]): BackendState {
    return backends.reduce((min, b) =>
      b.status.currentRequests < min.status.currentRequests ? b : min
    );
  }

  /**
   * Random selection
   */
  private selectRandom(backends: BackendState[]): BackendState {
    return backends[Math.floor(Math.random() * backends.length)];
  }

  /**
   * Failover - always use the first healthy backend
   */
  private selectFailover(backends: BackendState[]): BackendState {
    return backends[0];
  }

  /**
   * Increment request counter for a backend
   */
  startRequest(backendId: string): void {
    const backend = this.backends.get(backendId);
    if (backend) {
      backend.status.currentRequests++;
      backend.status.totalRequests++;
      backend.status.lastRequestTime = Date.now();
    }
  }

  /**
   * Mark request as completed
   */
  completeRequest(backendId: string, latency: number): void {
    const backend = this.backends.get(backendId);
    if (backend) {
      backend.status.currentRequests--;
      // Update average latency with exponential moving average
      const alpha = 0.1;
      backend.status.avgLatency =
        backend.status.avgLatency === 0
          ? latency
          : alpha * latency + (1 - alpha) * backend.status.avgLatency;
    }
  }

  /**
   * Mark request as failed
   */
  failRequest(backendId: string, error: string): void {
    const backend = this.backends.get(backendId);
    if (backend) {
      backend.status.currentRequests--;
      backend.status.failedRequests++;
      backend.status.lastError = error;
      backend.status.healthy = false;

      // Mark as unhealthy temporarily
      setTimeout(() => {
        const b = this.backends.get(backendId);
        if (b) {
          b.status.healthy = true;
          this.logger.info({ backendId }, 'Backend marked as healthy again');
        }
      }, 30000); // 30 seconds cooldown
    }
  }

  /**
   * Get all backend statuses
   */
  getBackendStatuses(): BackendStatusType[] {
    return Array.from(this.backends.values()).map((b) => b.status as BackendStatusType);
  }

  /**
   * Get a specific backend
   */
  getBackend(id: string): BackendState | undefined {
    return this.backends.get(id);
  }

  /**
   * Get all registered backend IDs
   */
  getBackendIds(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Check if a backend can accept more requests
   */
  canAcceptRequest(backendId: string): boolean {
    const backend = this.backends.get(backendId);
    if (!backend) return false;
    return (
      backend.config.enabled &&
      backend.status.healthy &&
      backend.status.currentRequests < backend.config.maxConcurrent
    );
  }
}
