/**
 * Test fixture data for ukb-agent tests
 *
 * Provides reusable mock data for common test scenarios.
 * Based on real API responses from the UKB MCP service.
 */

import type {
  DatabaseInfo,
  DatabaseTableInfo,
  DatabaseFieldInfo,
  CohortListItem,
  CohortInfo,
  CohortDetail,
  FieldDictResponse,
  FieldDictItem,
} from '../client/types.js';

export const fixtures = {
  /**
   * Sample database info - based on real UKB MCP API response
   */
  database: {
    create: (overrides?: Partial<DatabaseInfo>): DatabaseInfo => ({
      id: 'record-J7GFPxQJj70jq751KpK1zjp3',
      name: 'olink_hypertension',
      state: 'closed',
      project: 'project-J3Y7p9jJj70gKV8XKv2yxqv5',
      created: 1775810550000,
      modified: 1775810550485,
      ...overrides,
    }),
  },

  /**
   * Sample table info
   */
  table: {
    create: (overrides?: Partial<DatabaseTableInfo>): DatabaseTableInfo => ({
      name: 'participant',
      ...overrides,
    }),
  },

  /**
   * Sample field info - based on real UKB field structure
   */
  field: {
    create: (overrides?: Partial<DatabaseFieldInfo>): DatabaseFieldInfo => ({
      entity: 'participant',
      name: 'eid',
      type: 'string',
      title: 'Participant ID',
      ...overrides,
    }),
  },

  /**
   * Sample cohort list item - based on real UKB MCP API response
   */
  cohort: {
    create: (overrides?: Partial<CohortListItem>): CohortListItem => ({
      id: 'record-J7GFPxQJj70jq751KpK1zjp3',
      name: 'olink_hypertension',
      project: 'project-J3Y7p9jJj70gKV8XKv2yxqv5',
      state: 'closed',
      created: 1775810550000,
      modified: 1775810550485,
      ...overrides,
    }),
  },

  /**
   * Sample cohort info (with participant count) - based on real UKB MCP API response
   */
  cohortInfo: {
    create: (overrides?: Partial<CohortInfo>): CohortInfo => ({
      id: 'record-J7GFPxQJj70jq751KpK1zjp3',
      name: 'olink_hypertension',
      project: 'project-J3Y7p9jJj70gKV8XKv2yxqv5',
      folder: '/',
      state: 'closed',
      description: 'Olink hypertension study cohort with ICD-10 I10 filter',
      created: 1775810550000,
      modified: 1775810550485,
      participant_count: 1234,
      entity_fields: ['participant.eid', 'participant.p30903_i0'],
      ...overrides,
    }),
  },

  /**
   * Sample cohort detail - based on real UKB MCP API response
   */
  cohortDetail: {
    create: (overrides?: Partial<CohortDetail>): CohortDetail => ({
      id: 'record-J7GFPxQJj70jq751KpK1zjp3',
      name: 'olink_hypertension',
      project: 'project-J3Y7p9jJj70gKV8XKv2yxqv5',
      state: 'closed',
      created: 1775810550000,
      modified: 1775810550485,
      details: {
        description: 'Olink hypertension study cohort',
        dashboardConfig: {
          cohort_browser: {
            config: { showHeader: true, showFooter: true, showFilter: true },
            id: 'cohort_browser',
            type: 'cohort_browser',
            containers: [],
          },
        },
      },
      ...overrides,
    }),
  },

  /**
   * Sample field dictionary item - based on real UKB MCP API response
   */
  fieldDictItem: {
    create: (overrides?: Partial<FieldDictItem>): FieldDictItem => ({
      entity: 'participant',
      name: 'p30903_i0',
      type: 'integer',
      title: 'UKB-PPP Consortium selected participant | Instance 0',
      description: null,
      coding_name: null,
      concept: null,
      folder_path: null,
      is_multi_select: null,
      is_sparse_coding: null,
      linkout: null,
      longitudinal_axis_type: null,
      referenced_entity_field: null,
      relationship: null,
      units: null,
      ...overrides,
    }),
  },

  /**
   * Sample field dictionary response - based on real UKB MCP API response
   */
  fieldDictResponse: {
    create: (overrides?: Partial<FieldDictResponse>): FieldDictResponse => ({
      total: 5,
      page: 1,
      page_size: 5,
      data: [
        fixtures.fieldDictItem.create(),
        {
          entity: 'participant',
          name: 'eid',
          type: 'string',
          title: 'Participant ID',
          description: null,
          coding_name: null,
          concept: null,
          folder_path: 'Participant Information',
          is_multi_select: null,
          is_sparse_coding: null,
          linkout: null,
          longitudinal_axis_type: null,
          referenced_entity_field: null,
          relationship: null,
          units: null,
        },
        {
          entity: 'participant',
          name: 'p3_i0',
          type: 'integer',
          title: 'Verbal interview duration | Instance 0',
          description: null,
          coding_name: null,
          concept: null,
          folder_path: 'Assessment centre > Procedural metrics > Process durations',
          is_multi_select: null,
          is_sparse_coding: null,
          linkout: 'http://biobank.ctsu.ox.ac.uk/crystal/field.cgi?id=3',
          longitudinal_axis_type: null,
          referenced_entity_field: null,
          relationship: null,
          units: 'seconds',
        },
      ],
      ...overrides,
    }),
  },
};
