/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  cacheDir: '../../node_modules/.vite/libs/component-hub',
  test: {
    name: 'component-hub',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'src/**/*.{integrated,e2e}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/component-hub',
      provider: 'v8' as const,
    },
  },
}));
