/**
 * Script to fix duplicate link issues
 */

import { connectToDatabase } from '@/lib/db/mongodb';
import { createLoggerWithPrefix } from '@/lib/console/logger';

const logger = createLoggerWithPrefix('FixDuplicateLinks');

async function fixDuplicateLinks() {
  try {
    logger.info('Starting to fix duplicate link issues...');

    const { db } = await connectToDatabase();
    const linksCollection = db.collection('links');

    // Step 1: Remove duplicate links
    logger.info('Removing duplicate links...');

    // Find and remove duplicates
    const duplicates = await linksCollection
      .aggregate([
        {
          $group: {
            _id: {
              sourceId: '$sourceId',
              targetId: '$targetId',
              linkType: '$linkType',
            },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
      ])
      .toArray();

    logger.info(`Found ${duplicates.length} duplicate groups`);

    // Remove duplicates, keeping only the latest
    for (const group of duplicates) {
      const idsToKeep = group.ids.slice(0, 1); // Keep first one
      const idsToRemove = group.ids.slice(1);

      const result = await linksCollection.deleteMany({
        _id: { $in: idsToRemove },
      });

      logger.info(
        `Removed ${result.deletedCount} duplicates for group: ${JSON.stringify(group._id)}`,
      );
    }

    // Step 2: Update indexes to prevent future duplicates
    logger.info('Updating indexes...');

    // Drop existing unique index
    try {
      await linksCollection.dropIndex('sourceId_1_targetId_1');
      logger.info('Dropped old unique index');
    } catch (error) {
      logger.info('Old index not found or already dropped');
    }

    // Create new composite index
    await linksCollection.createIndex(
      { sourceId: 1, targetId: 1, linkType: 1 },
      { unique: true },
    );
    logger.info('Created new unique composite index');

    // Step 3: Verify fix
    const finalCount = await linksCollection.countDocuments();
    logger.info(`Final link count: ${finalCount}`);

    logger.info('Duplicate link fix completed successfully');
  } catch (error) {
    logger.error(`Failed to fix duplicate links: ${error}`);
    throw error;
  }
}

// Run fix if called directly
if (require.main === module) {
  fixDuplicateLinks();
}

export { fixDuplicateLinks };
