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
    reporters: ['default'],
  },
}));
