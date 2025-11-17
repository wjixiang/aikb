import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@aikb/s3-service': 'node_modules/@aikb/s3-service/src/index.ts',
      '@aikb/chunking': 'node_modules/@aikb/chunking/src/index.ts',
      '@aikb/embedding': 'node_modules/@aikb/embedding/src/index.ts',
      'log-management': 'node_modules/log-management/src/index.ts',
      '@aikb/pdf-converter': 'node_modules/@aikb/pdf-converter/src/index.ts',
    },
  },
});
