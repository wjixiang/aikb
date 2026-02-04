import { config } from 'dotenv';
import { syncFileToDb, closePrismaClient } from '../lib/db-storage.js';

// Load environment variables
config();

/**
 * Main function to sync a single OSS file to database
 */
async function main() {
    // Get year and filename from command line arguments
    const year = process.argv[2];
    const fileName = process.argv[3];

    if (!year || !fileName) {
        console.error('Usage: npx tsx libs/pubmedMirror/src/scripts/sync_file_to_db.ts <year> <filename>');
        console.error('Example: npx tsx libs/pubmedMirror/src/scripts/sync_file_to_db.ts 2024 pubmed24n0001.xml.gz');
        process.exit(1);
    }

    // Validate year format (4 digits)
    if (!/^\d{4}$/.test(year)) {
        console.error('Invalid year format. Please provide a 4-digit year (e.g., 2024)');
        process.exit(1);
    }

    console.log(`Starting sync of ${fileName} from OSS to database...`);
    console.log('========================================');

    try {
        const results = await syncFileToDb(year, fileName);

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        console.log('========================================');
        console.log('Sync completed!');
        console.log(`Total Articles: ${results.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failedCount}`);

        if (failedCount > 0) {
            console.log('\nFailed articles:');
            results
                .filter(r => !r.success)
                .forEach(r => {
                    console.log(`  - PMID ${r.pmid}: ${r.error}`);
                });
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
