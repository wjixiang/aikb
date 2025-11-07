import { mineruClient } from './mineru-client';

describe('mineruClient', () => {
  it('should work', () => {
    expect(mineruClient()).toEqual('mineru-client');
  });
});
