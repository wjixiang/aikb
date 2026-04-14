/**
 * UkbComponent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UkbComponent } from '../UkbComponent.js';
import { MockUkbMcpClient } from '../../__tests__/mocks/MockUkbMcpClient.js';
import { fixtures } from '../../__tests__/fixtures.js';

describe('UkbComponent', () => {
  let component: UkbComponent;
  let mockClient: MockUkbMcpClient;

  beforeEach(() => {
    mockClient = new MockUkbMcpClient();
    component = new UkbComponent(mockClient);
  });

  it('should have correct metadata', () => {
    expect(component.componentId).toBe('ukb-data');
    expect(component.displayName).toBe('UKB Data Explorer');
  });

  it('should define all expected tools', () => {
    const toolDefs = component.toolDefs();
    expect(toolDefs).toHaveProperty('list_databases');
    expect(toolDefs).toHaveProperty('query_field_dict');
    expect(toolDefs).toHaveProperty('list_cohorts');
    expect(toolDefs).toHaveProperty('create_cohort');
    expect(toolDefs).toHaveProperty('preview_cohort_data');
    expect(toolDefs).toHaveProperty('query_association');
    expect(toolDefs).toHaveProperty('export_data');
  });

  it('should route unknown tools to error', async () => {
    const result = await component.handleToolCall('unknown_tool', {});
    expect(result.success).toBe(false);
  });

  it('onList_databases should return markdown table', async () => {
    mockClient.mock('listDatabases').resolve([fixtures.database.create()]);
    const result = await component.onList_databases({});
    expect(result.success).toBe(true);
    expect(typeof result.data).toBe('string');
    expect(result.data).toContain('| ID | Name | State |');
    expect(result.data).toContain('olink_hypertension');
  });

  it('onQuery_field_dict should return field dict', async () => {
    mockClient.mock('queryFieldsDict').resolve(fixtures.fieldDictResponse.create());
    const result = await component.onQuery_field_dict({ condition: 'blood' });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('blood');
  });

  it('onCreate_cohort should return cohort info', async () => {
    mockClient.mock('createCohort').resolve(fixtures.cohortInfo.create());
    const result = await component.onCreate_cohort({ name: 'Test', filters: { field: 'participant.eid', operator: 'is_not_null' } });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('Test');
  });

  it('onExport_data should use csv by default', async () => {
    mockClient.mock('exportCsv').resolve({ exportId: 'e1' });
    const result = await component.onExport_data({ fields: ['participant.eid'] });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('CSV');
  });

  it('onExport_data should use parquet when specified', async () => {
    mockClient.mock('exportParquet').resolve({ exportId: 'e2' });
    const result = await component.onExport_data({ fields: [], format: 'parquet' });
    expect(result.success).toBe(true);
    expect(result.summary).toContain('PARQUET');
  });
});
