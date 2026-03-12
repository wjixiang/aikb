// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    noExternal: [],
    external: [
        '@prisma/client',
        '@prisma/client-runtime',
        'embedding',
        '@libs/embedding'
    ],
    outDir: 'dist',
})
