import { IdUtils } from './utils.js';

describe('IdUtils', () => {
  it('should generate a unique ID', () => {
    const id1 = IdUtils.generateId();
    const id2 = IdUtils.generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should generate a UUID', () => {
    const uuid1 = IdUtils.generateUUID();
    const uuid2 = IdUtils.generateUUID();

    expect(uuid1).toBeDefined();
    expect(uuid2).toBeDefined();
    expect(uuid1).not.toBe(uuid2);
    expect(uuid1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
