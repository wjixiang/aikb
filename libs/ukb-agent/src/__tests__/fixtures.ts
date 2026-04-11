/**
 * Test fixture data for ukb-agent tests
 *
 * Provides reusable mock data for common test scenarios.
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
   * Sample database info
   */
  database: {
    create: (overrides?: Partial<DatabaseInfo>): DatabaseInfo => ({
      id: 'database-001',
      name: 'ukb_main',
      state: 'active',
      project: 'ukb-project',
      created: 1704067200000,
      modified: 1704067200000,
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
   * Sample field info
   */
  field: {
    create: (overrides?: Partial<DatabaseFieldInfo>): DatabaseFieldInfo => ({
      entity: 'participant',
      name: 'eid',
      type: 'integer',
      title: 'Participant ID',
      ...overrides,
    }),
  },

  /**
   * Sample cohort list item
   */
  cohort: {
    create: (overrides?: Partial<CohortListItem>): CohortListItem => ({
      id: 'cohort-001',
      name: 'Test Cohort',
      project: 'ukb-project',
      state: 'active',
      created: 1704067200000,
      modified: 1704067200000,
      ...overrides,
    }),
  },

  /**
   * Sample cohort info (with participant count)
   */
  cohortInfo: {
    create: (overrides?: Partial<CohortInfo>): CohortInfo => ({
      id: 'cohort-001',
      name: 'Test Cohort',
      project: 'ukb-project',
      folder: '/',
      state: 'active',
      description: 'A test cohort',
      created: 1704067200000,
      modified: 1704067200000,
      participant_count: 1000,
      entity_fields: ['participant.eid', 'participant.p31'],
      ...overrides,
    }),
  },

  /**
   * Sample cohort detail
   */
  cohortDetail: {
    create: (overrides?: Partial<CohortDetail>): CohortDetail => ({
      id: 'cohort-001',
      name: 'Test Cohort',
      project: 'ukb-project',
      state: 'active',
      created: 1704067200000,
      modified: 1704067200000,
      details: {
        description: 'A test cohort',
        participant_count: 1000,
      },
      ...overrides,
    }),
  },

  /**
   * Sample field dictionary item
   */
  fieldDictItem: {
    create: (overrides?: Partial<FieldDictItem>): FieldDictItem => ({
      entity: 'participant',
      name: 'p31',
      type: 'integer',
      title: 'Sex',
      description: 'Sex of the participant',
      units: null,
      coding_name: null,
      concept: 'http://snomed.info/sct/248153002',
      ...overrides,
    }),
  },

  /**
   * Sample field dictionary response
   */
  fieldDictResponse: {
    create: (overrides?: Partial<FieldDictResponse>): FieldDictResponse => ({
      total: 1,
      page: 1,
      page_size: 20,
      data: [fixtures.fieldDictItem.create()],
      ...overrides,
    }),
  },
};
