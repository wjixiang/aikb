import type { IRuntimeControlClient } from './types.js';

export class RuntimeControlState {
  private _runtimeClient?: IRuntimeControlClient;

  setRuntimeClient(client: IRuntimeControlClient): void {
    this._runtimeClient = client;
  }

  getRuntimeClient(): IRuntimeControlClient | undefined {
    return this._runtimeClient;
  }
}
