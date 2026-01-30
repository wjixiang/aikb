import { libraryShared } from './library-shared';

describe('agent-lib', () => {
  it('should work', () => {
    expect(libraryShared()).toEqual('agent-lib');
  });
});
