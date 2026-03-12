/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
    cacheDir: '../../node_modules/.vite/libs/bib-lib-integrated',
    test: {
        name: 'bib-lib-integrated',
        watch: false,
        globals: true,
        environment: 'node',
        root: __dirname,
        include: ['{src,tests}/**/*.{integrated,e2e}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        reporters: ['default'],
        coverage: {
            reportsDirectory: '../../coverage/libs/bib-lib-integrated',
            provider: 'v8' as const,
        },
    },
}));
