/**
 * Mock UkbMcpClient for testing
 *
 * Allows tests to inject fake responses for each API method.
 * Usage:
 * ```
 * const mockClient = new MockUkbMcpClient();
 * mockClient.mock('listDatabases').resolve([{ id: 'db-1', name: 'test', state: 'active', project: 'test', created: Date.now(), modified: Date.now() }]);
 * const component = new UkbComponent(mockClient as unknown as UkbMcpClient);
 * ```
 */

import type {
  CohortCreateRequest,
  CohortDetail,
  CohortInfo,
  CohortListItem,
  DatabaseFieldInfo,
  DatabaseInfo,
  DatabaseQueryRequest,
  DatabaseTableInfo,
  ExportRequest,
  ExtractFieldsRequest,
  FieldDictResponse,
  AssociationQuery,
} from '../../client/types.js';
import { UkbMcpClient } from '../../client/UkbMcpClient.js';

type MethodName = keyof MockUkbMcpClient;
type MockFn<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  once: (value: T) => MockFn<T>;
  promise: Promise<T>;
};

type MockedMethods = {
  healthCheck: () => MockFn<unknown>;
  listDatabases: () => MockFn<DatabaseInfo[]>;
  findDatabase: () => MockFn<DatabaseInfo[]>;
  getDatabase: () => MockFn<DatabaseInfo>;
  describeDatabase: () => MockFn<unknown>;
  listTables: () => MockFn<DatabaseTableInfo[]>;
  listFields: () => MockFn<DatabaseFieldInfo[]>;
  queryDatabase: () => MockFn<unknown>;
  exportDatabase: () => MockFn<unknown>;
  listCohorts: () => MockFn<CohortListItem[]>;
  findCohort: () => MockFn<CohortListItem[]>;
  getCohort: () => MockFn<CohortDetail>;
  createCohort: () => MockFn<CohortInfo>;
  deleteCohort: () => MockFn<unknown>;
  extractCohortFields: () => MockFn<unknown>;
  listFieldsDict: () => MockFn<FieldDictResponse>;
  queryFieldsDict: () => MockFn<FieldDictResponse>;
  queryAssociation: () => MockFn<unknown>;
  exportCsv: () => MockFn<unknown>;
  exportParquet: () => MockFn<unknown>;
};

export class MockUkbMcpClient extends UkbMcpClient {
  private mocks: Map<string, MockFn<unknown>> = new Map();
  private defaultValues: Map<string, unknown> = new Map();

  constructor() {
    super('http://localhost:8000');
  }

  /**
   * Get a mock handler for a specific method
   */
  mock<K extends MethodName>(method: K): MockFn<unknown> {
    let mockFn = this.mocks.get(method) as MockFn<unknown> | undefined;
    if (!mockFn) {
      mockFn = this.createMockFn();
      this.mocks.set(method, mockFn);
    }
    return mockFn;
  }

  /**
   * Set a default return value for a method (used when no mock is set up)
   */
  setDefault<K extends MethodName>(method: K, value: unknown): void {
    this.defaultValues.set(method, value);
  }

  /**
   * Reset all mocks and default values
   */
  reset(): void {
    this.mocks.clear();
    this.defaultValues.clear();
  }

  private createMockFn<T>(): MockFn<T> {
    let resolveFn: (value: T) => void = () => {};
    let rejectFn: (error: Error) => void = () => {};

    const promise = new Promise<T>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    const mockFn = {
      resolve: (value: T) => resolveFn(value),
      reject: (error: Error) => rejectFn(error),
      once: function (value: T) {
        resolveFn(value);
        return mockFn;
      },
      promise,
    };

    return mockFn as unknown as MockFn<T>;
  }

  private getMockResult(method: string): Promise<unknown> {
    const mock = this.mocks.get(method);
    if (mock) {
      // Return the mock's promise - caller must have called .resolve() or .once()
      return (mock as MockFn<unknown>).promise as Promise<unknown>;
    }
    const defaultValue = this.defaultValues.get(method);
    if (defaultValue !== undefined) {
      return Promise.resolve(defaultValue);
    }
    throw new Error(`MockUkbMcpClient: No mock set for "${method}". Use mock('${method}').resolve(value) to set up.`);
  }

  // ==================== Mock API Methods ====================

  healthCheck(): Promise<unknown> {
    return this.getMockResult('healthCheck') as Promise<unknown>;
  }

  listDatabases(_params?: { name?: string; refresh?: boolean }): Promise<DatabaseInfo[]> {
    return this.getMockResult('listDatabases') as Promise<DatabaseInfo[]>;
  }

  findDatabase(params: { name: string; refresh?: boolean }): Promise<DatabaseInfo[]> {
    return this.getMockResult('findDatabase') as Promise<DatabaseInfo[]>;
  }

  getDatabase(databaseId: string, _params?: { refresh?: boolean }): Promise<DatabaseInfo> {
    return this.getMockResult('getDatabase') as Promise<DatabaseInfo>;
  }

  describeDatabase(databaseId: string, _params?: { refresh?: boolean }): Promise<unknown> {
    return this.getMockResult('describeDatabase') as Promise<unknown>;
  }

  listTables(databaseId: string, _params?: { refresh?: boolean; limit?: number; offset?: number }): Promise<{ data: DatabaseTableInfo[]; total: number; limit: number; offset: number }> {
    return this.getMockResult('listTables') as Promise<{ data: DatabaseTableInfo[]; total: number; limit: number; offset: number }>;
  }

  listFields(
    databaseId: string,
    _params?: { entity?: string; name?: string; refresh?: boolean; limit?: number; offset?: number },
  ): Promise<{ data: DatabaseFieldInfo[]; total: number; limit: number; offset: number }> {
    return this.getMockResult('listFields') as Promise<{ data: DatabaseFieldInfo[]; total: number; limit: number; offset: number }>;
  }

  queryDatabase(databaseId: string, body: DatabaseQueryRequest): Promise<{ data: unknown[]; total: number; limit: number; offset: number }> {
    return this.getMockResult('queryDatabase') as Promise<{ data: unknown[]; total: number; limit: number; offset: number }>;
  }

  exportDatabase(databaseId: string, body: ExportRequest): Promise<unknown> {
    return this.getMockResult('exportDatabase') as Promise<unknown>;
  }

  listCohorts(_params?: { name?: string; limit?: number; refresh?: boolean }): Promise<CohortListItem[]> {
    return this.getMockResult('listCohorts') as Promise<CohortListItem[]>;
  }

  findCohort(params: { name: string; refresh?: boolean }): Promise<CohortListItem[]> {
    return this.getMockResult('findCohort') as Promise<CohortListItem[]>;
  }

  getCohort(cohortId: string, _params?: { refresh?: boolean }): Promise<CohortDetail> {
    return this.getMockResult('getCohort') as Promise<CohortDetail>;
  }

  createCohort(body: CohortCreateRequest): Promise<CohortInfo> {
    return this.getMockResult('createCohort') as Promise<CohortInfo>;
  }

  deleteCohort(cohortId: string): Promise<unknown> {
    return this.getMockResult('deleteCohort') as Promise<unknown>;
  }

  extractCohortFields(cohortId: string, body: ExtractFieldsRequest): Promise<{ data: unknown[]; total: number; limit: number; offset: number }> {
    return this.getMockResult('extractCohortFields') as Promise<{ data: unknown[]; total: number; limit: number; offset: number }>;
  }

  listFieldsDict(_params?: { page?: number; page_size?: number }): Promise<FieldDictResponse> {
    return this.getMockResult('listFieldsDict') as Promise<FieldDictResponse>;
  }

  queryFieldsDict(params: { condition: string; page?: number; page_size?: number }): Promise<FieldDictResponse> {
    return this.getMockResult('queryFieldsDict') as Promise<FieldDictResponse>;
  }

  queryAssociation(body: AssociationQuery): Promise<unknown> {
    return this.getMockResult('queryAssociation') as Promise<unknown>;
  }

  exportCsv(body: ExportRequest): Promise<unknown> {
    return this.getMockResult('exportCsv') as Promise<unknown>;
  }

  exportParquet(body: ExportRequest): Promise<unknown> {
    return this.getMockResult('exportParquet') as Promise<unknown>;
  }
}
