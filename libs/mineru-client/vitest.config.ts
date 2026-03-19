/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  cacheDir: '../../node_modules/.vite/libs/mineru-client',
  test: {
    name: 'mineru-client',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['src/**/*.e2e.test.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/mineru-client',
      provider: 'v8' as const,
    },
  },
}));
