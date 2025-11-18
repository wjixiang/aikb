import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'libraryItemVectorService-e2e',
    environment: 'node',
    setupFiles: [resolve(__dirname, 'src/support/test-setup.ts')],
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '../../coverage/libraryItemVectorService-e2e',
    },
  },
  resolve: {
    alias: {
      'proto-ts': resolve(__dirname, '../../dist/protos/proto-ts'),
    },
  },
});
