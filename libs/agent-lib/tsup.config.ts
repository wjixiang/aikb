// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'src/core/index': 'src/core/index.ts',
    'src/components/index': 'src/components/index.ts',
  },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  esbuildOptions(options) {
    options.external = ['@prisma/client-runtime-utils', 'pino']
  },
})
