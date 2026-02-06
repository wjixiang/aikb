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
    name: 'agent-lib-integrated',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests}/**/*.integrated.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
    },
  },
}));
