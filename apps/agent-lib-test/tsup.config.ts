import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/demo-expert.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    esbuildOptions(options) {
        options.external = ['pino', 'agent-lib', 'med_database_portal'];
    },
});
