/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  cacheDir: '../../node_modules/.vite/libs/file-renderer',
  test: {
    name: 'file-renderer',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      reportsDirectory: '../../coverage/libs/file-renderer',
      provider: 'v8' as const,
    },
  },
}));
