export interface IAgentSleepControl {
  isSleeping(): boolean;
  sleep(reason: string): Promise<void>;
}

export class LazySleepControl implements IAgentSleepControl {
  private _delegate: IAgentSleepControl | null = null;
  private _resolver: (() => IAgentSleepControl) | null = null;

  setResolver(resolver: () => IAgentSleepControl): void {
    this._resolver = resolver;
  }

  private get delegate(): IAgentSleepControl {
    if (!this._delegate) {
      if (!this._resolver) throw new Error('SleepControl resolver not set');
      this._delegate = this._resolver();
    }
    return this._delegate;
  }

  isSleeping(): boolean {
    return this.delegate.isSleeping();
  }

  sleep(reason: string): Promise<void> {
    return this.delegate.sleep(reason);
  }
}
