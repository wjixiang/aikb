/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  cacheDir: '../../node_modules/.vite/libs/ai-embed',
  test: {
    name: 'ai-embed',
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
      reportsDirectory: '../../coverage/libs/ai-embed',
      provider: 'v8' as const,
    },
  },
}));
