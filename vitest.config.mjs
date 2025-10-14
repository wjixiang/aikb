import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000, // Increase timeout for hooks to 30 seconds
    testTimeout: 10000, // Increase timeout for individual tests to 10 seconds
    setupFiles: ['./test/setup.ts'],
    include: ['./knowledgeBase/**/*.test.ts', './pdfProcess-ts/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.venv/**',
      '**/dist/**',
      // '**/*.integration.test.ts',
    ],
    watch: false,
    watchExclude: [
      '**/node_modules/**',
      '**/.venv/**',
      '**/dist/**'
    ],
    server: {
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/.venv/**',
          '**/dist/**'
        ]
      }
    }
  },
  resolve: {
    // Add this to help with module resolution
    alias: {
      '@': './src',
    },
  },
})