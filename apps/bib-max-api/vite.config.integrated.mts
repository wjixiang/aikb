/// <reference types='vitest' />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig(() => ({
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  test: {
    name: 'bib-max-integrated',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests}/**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
    },
  },
}));
