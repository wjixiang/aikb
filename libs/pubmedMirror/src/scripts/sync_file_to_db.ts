import { config } from 'dotenv';
import { syncFileToDb, closePrismaClient } from '../lib/db-storage.js';
import { fileExistsInOSS } from '../lib/oss-storage.js';

// Load environment variables
config();

/**
 * Test if file exists in OSS
 */
async function checkFileExists(year: string, fileName: string): Promise<boolean> {
    try {
        console.log(`Checking if file exists in OSS: baseline/${year}/${fileName}`);
        const exists = await fileExistsInOSS(fileName, year);
        if (exists) {
            console.log(`✓ File found in OSS`);
            return true;
        } else {
            console.error(`✗ File not found in OSS: baseline/${year}/${fileName}`);
            console.error('\nTroubleshooting tips:');
            console.error('  1. Verify the filename is correct');
            console.error('  2. Check if the file has been synced to OSS');
            console.error('  3. Use sync_baseline.ts to sync from FTP first');
            return false;
        }
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
        return false;
    }
}

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

    // Check if file exists first
    const fileExists = await checkFileExists(year, fileName);
    if (!fileExists) {
        process.exit(1);
    }
    console.log();

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
