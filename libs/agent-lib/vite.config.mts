/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(() => ({
  cacheDir: '../../node_modules/.vite/libs/agent-lib',
  resolve: {
    alias: {
      '@': resolve(__dirname, '../..'),
      'agent-lib': resolve(__dirname, './src'),
      'agent-lib/*': resolve(__dirname, './src/*'),
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  test: {
    name: 'agent-lib',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['{src,tests}/**/*.integrated.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
    },
  },
  integrate: {
    name: 'agent-lib-integrated',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests}/**/*.integrated.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
    },
  },
}));
