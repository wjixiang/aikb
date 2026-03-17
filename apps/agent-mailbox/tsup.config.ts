import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outDir: 'dist',
  esbuildOptions(options) {
    options.external = [
      '@prisma/client',
      '@prisma/adapter-pg',
      'fastify',
      '@fastify/swagger',
      '@fastify/swagger-ui',
      'pg',
      'dotenv',
    ]
  },
})
