import { config } from 'dotenv';
import { syncBaselineFileToDb, closePrismaClient } from '../lib/db-storage.js';
import { listSyncedBaselineFiles } from '../lib/oss-storage.js';

// Load environment variables
config();

/**
 * Test OSS connectivity
 */
async function testOSSConnectivity(year: string): Promise<boolean> {
    try {
        console.log('Testing OSS connectivity...');
        const files = await listSyncedBaselineFiles(year);
        console.log(`✓ OSS connection successful. Found ${files.length} files for year ${year}`);
        return true;
    } catch (error) {
        console.error('✗ OSS connection failed:');
        if (error instanceof Error) {
            console.error(`  Error: ${error.message}`);
            if ('code' in error) {
                console.error(`  Code: ${(error as any).code}`);
            }
        }
        console.error('\nTroubleshooting tips:');
        console.error('  1. Check if S3_ENDPOINT is correct in .env file');
        console.error('  2. Verify network connectivity from devcontainer');
        console.error('  3. Check if OSS credentials are valid');
        console.error('  4. Ensure the bucket exists and is accessible');
        return false;
    }
}

/**
 * Main function to sync OSS data to database for a specified year
 */
async function main() {
    // Get year from command line argument
    const year = process.argv[2];

    if (!year) {
        console.error('Usage: npx tsx libs/pubmedMirror/src/scripts/sync_oss_to_db.ts <year>');
        console.error('Example: npx tsx libs/pubmedMirror/src/scripts/sync_oss_to_db.ts 2024');
        process.exit(1);
    }

    // Validate year format (4 digits)
    if (!/^\d{4}$/.test(year)) {
        console.error('Invalid year format. Please provide a 4-digit year (e.g., 2024)');
        process.exit(1);
    }

    console.log(`Starting sync of OSS baseline data to database for year ${year}...`);
    console.log('========================================');

    // Test OSS connectivity first
    const isConnected = await testOSSConnectivity(year);
    if (!isConnected) {
        process.exit(1);
    }
    console.log();

    try {
        const summary = await syncBaselineFileToDb(year);

        console.log('========================================');
        console.log('Sync completed successfully!');
        console.log(`Total Files: ${summary.totalFiles}`);
        console.log(`Processed Files: ${summary.processedFiles}`);
        console.log(`Total Articles: ${summary.totalArticles}`);
        console.log(`Success: ${summary.successArticles}`);
        console.log(`Failed: ${summary.failedArticles}`);

        if (summary.failedArticles > 0) {
            console.log(`\nWarning: ${summary.failedArticles} articles failed to sync`);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error during sync:', error);
        process.exit(1);
    } finally {
        // Close Prisma client connection
        await closePrismaClient();
        console.log('\nDatabase connection closed.');
    }
}

main();
