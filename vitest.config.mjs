import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000, // Increase timeout for hooks to 30 seconds
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    // Add this to help with module resolution
    alias: {
      '@': './src',
    },
  },
})