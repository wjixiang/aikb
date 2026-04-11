import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__tests__/fixtures.ts',
      '**/__tests__/test-setup.ts',
      '**/__tests__/mocks/**',
    ],
    setupFiles: ['./src/__tests__/test-setup.ts'],
  },
});
