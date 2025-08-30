import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  test,
  it,
  expect,
  vi,
} from 'vitest';

// Make Vitest functions globally available to support Jest-like syntax
Object.assign(global, {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  test,
  it,
  expect,
  vi,
});
