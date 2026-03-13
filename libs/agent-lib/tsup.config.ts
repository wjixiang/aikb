// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'scripts/article-retrieval-skill.ts',
    'src/expert/cli/index.ts'
  ],
  format: ['cjs', 'esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  esbuildOptions(options) {
    options.external = ['@prisma/client-runtime-utils', 'pino']
  },
})
