export interface ITransactionManager {
  beginTransaction(transactionId?: string): Promise<string>;
  commitTransaction(transactionId: string): Promise<void>;
  rollbackTransaction(transactionId: string): Promise<void>;
  getTransactionStatus(transactionId: string): Promise<TransactionStatus>;
  executeInTransaction<T>(
    operations: () => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
  getActiveTransactions(): Promise<TransactionContext[]>;
  cleanupExpiredTransactions(): Promise<number>;
}

export enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  TIMEOUT = 'timeout'
}

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: IsolationLevel;
  retryPolicy?: RetryPolicy;
  readOnly?: boolean;
  savepoint?: string;
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED = 'read_committed',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable'
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface TransactionContext {
  transactionId: string;
  status: TransactionStatus;
  startTime: Date;
  endTime?: Date;
  operations: TransactionOperation[];
  savepoints: Map<string, Savepoint>;
  metadata?: Record<string, any>;
  isolationLevel: IsolationLevel;
  timeout?: number;
  userId?: string;
  sessionId?: string;
}

export interface TransactionOperation {
  operationId: string;
  type: 'create' | 'update' | 'delete' | 'read';
  entityType: string;
  entityId: string;
  data?: any;
  oldData?: any;
  timestamp: Date;
  savepoint?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: Error;
}

export interface Savepoint {
  name: string;
  timestamp: Date;
  operationCount: number;
  state: any; // 序列化的事务状态
}

export interface TransactionMetrics {
  totalTransactions: number;
  activeTransactions: number;
  committedTransactions: number;
  rolledBackTransactions: number;
  averageTransactionTime: number;
  averageOperationCount: number;
  timeoutRate: number;
  retryRate: number;
  isolationLevelStats: Record<IsolationLevel, number>;
}

// 事务事件
export interface TransactionEvent {
  transactionId: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface TransactionStartedEvent extends TransactionEvent {
  eventType: 'transaction.started';
  isolationLevel: IsolationLevel;
  timeout?: number;
}

export interface TransactionCommittedEvent extends TransactionEvent {
  eventType: 'transaction.committed';
  operationCount: number;
  duration: number;
}

export interface TransactionRolledBackEvent extends TransactionEvent {
  eventType: 'transaction.rolled_back';
  reason: string;
  duration: number;
  operationCount: number;
}

export interface SavepointCreatedEvent extends TransactionEvent {
  eventType: 'transaction.savepoint_created';
  savepointName: string;
  operationCount: number;
}

export interface SavepointRolledBackEvent extends TransactionEvent {
  eventType: 'transaction.savepoint_rolled_back';
  savepointName: string;
  operationCount: number;
}

// 事务配置
export interface TransactionManagerConfig {
  defaultTimeout?: number;
  defaultIsolationLevel?: IsolationLevel;
  maxActiveTransactions?: number;
  cleanupInterval?: number;
  enableMetrics?: boolean;
  enableSavepoints?: boolean;
  retryPolicy?: RetryPolicy;
}

// 事务异常
export class TransactionError extends Error {
  constructor(
    message: string,
    public transactionId: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export class TransactionTimeoutError extends TransactionError {
  constructor(transactionId: string, timeout: number) {
    super(
      `Transaction ${transactionId} timed out after ${timeout}ms`,
      transactionId
    );
    this.name = 'TransactionTimeoutError';
  }
}

export class TransactionAbortedError extends TransactionError {
  constructor(transactionId: string, reason: string) {
    super(
      `Transaction ${transactionId} was aborted: ${reason}`,
      transactionId
    );
    this.name = 'TransactionAbortedError';
  }
}

export class ConcurrentModificationError extends TransactionError {
  constructor(
    transactionId: string,
    public entityType: string,
    public entityId: string
  ) {
    super(
      `Concurrent modification detected on ${entityType}:${entityId} in transaction ${transactionId}`,
      transactionId
    );
    this.name = 'ConcurrentModificationError';
  }
}