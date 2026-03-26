// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/prisma.ts'],
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
        '@prisma/adapter-pg',
        'pg',
        'jose',
        'js-cookie',
        'embedding',
        '@libs/embedding',
        '@ai-embed/core'
    ],
    outDir: 'dist',
})
