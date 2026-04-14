import type {
  AssociationQuery,
  CohortCreateRequest,
  CohortDetail,
  CohortDownloadResponse,
  CohortInfo,
  CohortListItem,
  DatabaseFieldInfo,
  DatabaseInfo,
  DatabaseQueryRequest,
  DatabaseTableInfo,
  ExportRequest,
  ExtractFieldsRequest,
  FieldDictResponse,
} from './types.js';

export class UkbMcpClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:8000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`UKB MCP API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ==================== Health ====================

  async healthCheck(): Promise<unknown> {
    return this.request('GET', '/health');
  }

  // ==================== Databases ====================

  async listDatabases(params?: {
    name?: string;
    refresh?: boolean;
  }): Promise<DatabaseInfo[]> {
    const sp = new URLSearchParams();
    if (params?.name) sp.set('name', params.name);
    if (params?.refresh) sp.set('refresh', 'true');
    const qs = sp.toString();
    return this.request('GET', `/api/v1/databases/${qs ? `?${qs}` : ''}`);
  }

  async findDatabase(params: {
    name: string;
    refresh?: boolean;
  }): Promise<DatabaseInfo[]> {
    const sp = new URLSearchParams();
    sp.set('name', params.name);
    if (params.refresh) sp.set('refresh', 'true');
    return this.request('GET', `/api/v1/databases/find?${sp}`);
  }

  async getDatabase(
    databaseId: string,
    params?: { refresh?: boolean },
  ): Promise<DatabaseInfo> {
    const sp = new URLSearchParams();
    if (params?.refresh) sp.set('refresh', 'true');
    return this.request(
      'GET',
      `/api/v1/databases/${databaseId}${sp.toString() ? `?${sp}` : ''}`,
    );
  }

  async describeDatabase(
    databaseId: string,
    params?: { refresh?: boolean },
  ): Promise<unknown> {
    const sp = new URLSearchParams();
    if (params?.refresh) sp.set('refresh', 'true');
    return this.request(
      'GET',
      `/api/v1/databases/${databaseId}/describe?${sp}`,
    );
  }

  async listTables(
    databaseId: string,
    params?: {
      refresh?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: DatabaseTableInfo[]; total: number; limit: number; offset: number }> {
    const sp = new URLSearchParams();
    if (params?.refresh) sp.set('refresh', 'true');
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    return this.request(
      'GET',
      `/api/v1/databases/${databaseId}/tables?${sp}`,
    );
  }

  async listFields(
    databaseId: string,
    params?: {
      entity?: string;
      name?: string;
      refresh?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: DatabaseFieldInfo[]; total: number; limit: number; offset: number }> {
    const sp = new URLSearchParams();
    if (params?.entity) sp.set('entity', params.entity);
    if (params?.name) sp.set('name', params.name);
    if (params?.refresh) sp.set('refresh', 'true');
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    return this.request(
      'GET',
      `/api/v1/databases/${databaseId}/fields?${sp}`,
    );
  }

  async queryDatabase(
    databaseId: string,
    body: DatabaseQueryRequest,
  ): Promise<{ data: unknown[]; total: number; limit: number; offset: number }> {
    return this.request('POST', `/api/v1/databases/${databaseId}/query`, body);
  }

  async exportDatabase(
    databaseId: string,
    body: ExportRequest,
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/api/v1/databases/${databaseId}/export`,
      body,
    );
  }

  // ==================== Cohorts ====================

  async listCohorts(params?: {
    name?: string;
    limit?: number;
    refresh?: boolean;
  }): Promise<CohortListItem[]> {
    const sp = new URLSearchParams();
    if (params?.name) sp.set('name', params.name);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.refresh) sp.set('refresh', 'true');
    return this.request('GET', `/api/v1/cohort/${sp.toString() ? `?${sp}` : ''}`);
  }

  async findCohort(params: {
    name: string;
    refresh?: boolean;
  }): Promise<CohortListItem[]> {
    const sp = new URLSearchParams();
    sp.set('name', params.name);
    if (params.refresh) sp.set('refresh', 'true');
    return this.request('GET', `/api/v1/cohort/find?${sp}`);
  }

  async getCohort(
    cohortId: string,
    params?: { refresh?: boolean },
  ): Promise<CohortDetail> {
    const sp = new URLSearchParams();
    if (params?.refresh) sp.set('refresh', 'true');
    return this.request(
      'GET',
      `/api/v1/cohort/${cohortId}${sp.toString() ? `?${sp}` : ''}`,
    );
  }

  async createCohort(body: CohortCreateRequest): Promise<CohortInfo> {
    return this.request('POST', '/api/v1/cohort/', body);
  }

  async deleteCohort(cohortId: string): Promise<unknown> {
    return this.request('DELETE', `/api/v1/cohort/${cohortId}`);
  }

  async closeCohort(cohortId: string): Promise<CohortDetail> {
    return this.request('POST', `/api/v1/cohort/${cohortId}/close`);
  }

  async extractCohortFields(
    cohortId: string,
    body: ExtractFieldsRequest,
  ): Promise<{ data: unknown[]; total: number; limit: number; offset: number }> {
    return this.request(
      'POST',
      `/api/v1/cohort/${cohortId}/extract`,
      body,
    );
  }

  async downloadCohort(
    cohortId: string,
    params?: { refresh?: boolean },
  ): Promise<CohortDownloadResponse> {
    const sp = new URLSearchParams();
    if (params?.refresh) sp.set('refresh', 'true');
    return this.request(
      'GET',
      `/api/v1/cohort/${cohortId}/download${sp.toString() ? `?${sp}` : ''}`,
    );
  }

  // ==================== Field Dictionary ====================

  async listFieldsDict(params?: {
    page?: number;
    page_size?: number;
  }): Promise<FieldDictResponse> {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.page_size) sp.set('page_size', String(params.page_size));
    return this.request(
      'GET',
      `/api/v1/field/list${sp.toString() ? `?${sp}` : ''}`,
    );
  }

  async queryFieldsDict(params: {
    condition: string;
    page?: number;
    page_size?: number;
  }): Promise<FieldDictResponse> {
    const sp = new URLSearchParams();
    sp.set('condition', params.condition);
    if (params.page) sp.set('page', String(params.page));
    if (params.page_size) sp.set('page_size', String(params.page_size));
    return this.request('GET', `/api/v1/field/query?${sp}`);
  }

  // ==================== Association ====================

  async queryAssociation(body: AssociationQuery): Promise<unknown> {
    return this.request('POST', '/api/v1/association/query', body);
  }

  // ==================== Export ====================

  async exportCsv(body: ExportRequest): Promise<unknown> {
    return this.request('POST', '/api/v1/export/csv', body);
  }

  async exportParquet(body: ExportRequest): Promise<unknown> {
    return this.request('POST', '/api/v1/export/parquet', body);
  }
}
