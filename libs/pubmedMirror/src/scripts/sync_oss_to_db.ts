import { config } from 'dotenv';
import { syncBaselineFileToDb, closePrismaClient } from '../lib/db-storage.js';

// Load environment variables
config();

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
