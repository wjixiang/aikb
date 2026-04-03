/// <reference types='vitest' />
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  test: {
    name: 'bib-max-test',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests,scripts}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['{src,tests}/**/*.{integrated,e2e}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', '{src,tests}/**/integration/**'],
    reporters: ['default'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/test-setup.ts'],
      all: true,
    },
  },
  integrate: {
    name: 'bib-max-integrated',
    watch: false,
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['{src,tests,scripts}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    // setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-lib',
      provider: 'v8' as const,
    },
  },
}));
