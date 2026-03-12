/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
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
            env: {
                BIB_DATABASE_URL: env.BIB_DATABASE_URL || 'postgresql://admin:fl5ox03@localhost:5432/biblib',
            },
        },
    };
});
