export class MinerUApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public traceId?: string,
  ) {
    super(`MinerU API Error [${code}]: ${message}`);
    this.name = 'MinerUApiError';
  }
}

export class MinerUTimeoutError extends Error {
  constructor(message: string) {
    super(`MinerU Timeout Error: ${message}`);
    this.name = 'MinerUTimeoutError';
  }
}
