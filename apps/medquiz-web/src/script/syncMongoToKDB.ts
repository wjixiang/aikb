import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import KDBManager, { SyncStatus } from '@/lib/db/KDBManager';
import { connectToDatabase } from '@/lib/db/mongodb'; // Assuming this utility exists and works
import { note } from '@/types/noteData.types';
import { Collection, Document } from 'mongodb'; // Import MongoDB types

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('collection', {
      alias: 'c',
      type: 'string',
      description: 'Name of the MongoDB collection to sync',
      demandOption: true, // Make the collection name mandatory
    })
    .option('batchSize', {
      alias: 'b',
      type: 'number',
      description: 'Batch size for KDBManager processing',
      default: 1,
    })
    .option('target', {
      alias: 't',
      type: 'string',
      description: 'Target database(s) to sync to: milvus, neo4j, or both',
      choices: ['milvus', 'neo4j', 'both'],
      default: 'both',
    })
    .help()
    .alias('help', 'h').argv;

  const collectionName = argv.collection;
  const batchSize = argv.batchSize;
  const target = argv.target;

  console.log(`Starting sync for MongoDB collection: ${collectionName}`);

  let dbConnection;
  try {
    // 1. Connect to MongoDB
    console.log('Connecting to MongoDB...');
    dbConnection = await connectToDatabase();
    const db = dbConnection.db;
    const mongoCollection: Collection<Document> = db.collection(collectionName);
    console.log('Connected to MongoDB.');

    // 2. Fetch all documents from the specified collection
    console.log(`Fetching documents from collection '${collectionName}'...`);
    // Fetch all documents. Be cautious with very large collections.
    // Consider using a cursor for memory efficiency if needed.
    const documents = await mongoCollection.find({}).toArray();
    console.log(`Fetched ${documents.length} documents.`);

    if (documents.length === 0) {
      console.log('No documents found in the collection. Exiting.');
      return;
    }

    // 3. Assume documents match the 'note' structure.
    // Add validation/transformation if necessary.
    // We need to ensure the data conforms to the 'note' type expected by KDBManager.
    // This might involve mapping fields or handling potential discrepancies.
    // For now, we'll cast, but robust implementation might need more checks.
    const notesToSync: note[] = documents
      .map((doc) => {
        // Basic transformation/validation example:
        // Ensure oid exists, content is an array, etc.
        if (!doc.oid || typeof doc.oid !== 'string') {
          console.warn(`Document missing or invalid oid, skipping: ${doc._id}`);
          return null; // Filter out invalid docs later
        }
        return {
          oid: doc.oid,
          fileName: doc.fileName || doc.oid, // Fallback for fileName
          metaData: doc.metaData || {},
          content: Array.isArray(doc.content)
            ? doc.content
            : [{ timeStamp: new Date(), fileContent: doc.content || '' }], // Ensure content is array
          // Map other fields if necessary
        } as note;
      })
      .filter((note): note is note => note !== null) // Filter out skipped docs
      .filter((note) => {
        // Exclude documents with "excalidraw" in metadata.tags
        const tags = note.metaData?.tags;
        if (Array.isArray(tags) && tags.includes('excalidraw')) {
          console.log(`Skipping Excalidraw document: ${note.oid}`);
          return false;
        }
        return true;
      });

    if (notesToSync.length === 0) {
      console.log('No valid notes found after filtering. Exiting.');
      return;
    }
    console.log(`Prepared ${notesToSync.length} notes for synchronization.`);

    // 4. Instantiate KDBManager
    const kdbManager = new KDBManager();
    // Optional: Initialize if needed (e.g., kdbManager.init())

    // 5. Call bulkAddNote with target-specific options
    console.log(
      `Starting synchronization with KDBManager (Batch Size: ${batchSize}, Target: ${target})...`,
    );

    // Create a modified bulkAddNote function based on target
    const bulkAddNoteWithTarget = async (notes: note[]) => {
      if (target === 'both') {
        return kdbManager.bulkAddNote(notes, {
          batchSize: batchSize,
          onProgress: ({ completed, total }) => {
            if (completed % (batchSize * 5) === 0 || completed === total) {
              console.log(
                `Sync Progress: ${completed}/${total} notes processed`,
              );
            }
          },
        });
      } else if (target === 'milvus') {
        // Only sync to Milvus
        const { db } = await connectToDatabase();
        const mongodbNoteCollection = db.collection<note>(
          kdbManager.mongodbNoteCollectionName,
        );

        // Check existing notes in MongoDB
        const existingMongoDocs = await mongodbNoteCollection
          .find(
            { oid: { $in: notes.map((n) => n.oid) } },
            { projection: { oid: 1 } },
          )
          .toArray();
        const existingMongoOidSet = new Set(
          existingMongoDocs.map((doc) => doc.oid),
        );

        // Filter notes for MongoDB insertion
        const notesToInsertMongo = notes.filter(
          (n) => !existingMongoOidSet.has(n.oid),
        );
        if (notesToInsertMongo.length > 0) {
          await mongodbNoteCollection.insertMany(notesToInsertMongo);
        }

        // Sync to Milvus with batch processing
        const milvusDocs = notes.map((note) => ({
          oid: note.oid,
          title: note.fileName,
          content: note.content[0]?.fileContent || '',
          partition_key: null,
        }));

        await kdbManager.milvusCollectionOperator.batchInsertDocuments(
          milvusDocs,
          {
            batchSize: batchSize,
            onProgress: ({ completed, total }) => {
              if (completed % (batchSize * 5) === 0 || completed === total) {
                console.log(
                  `Milvus Sync Progress: ${completed}/${total} notes processed`,
                );
              }
            },
          },
        );

        return notes.map((note) => ({
          status: SyncStatus.FULL_SYNC,
          message: 'Synced to MongoDB and Milvus only',
          recordIds: { oid: note.oid },
        }));
      } else if (target === 'neo4j') {
        // Only sync to Neo4j
        const { db } = await connectToDatabase();
        const mongodbNoteCollection = db.collection<note>(
          kdbManager.mongodbNoteCollectionName,
        );

        // Check existing notes in MongoDB
        const existingMongoDocs = await mongodbNoteCollection
          .find(
            { oid: { $in: notes.map((n) => n.oid) } },
            { projection: { oid: 1 } },
          )
          .toArray();
        const existingMongoOidSet = new Set(
          existingMongoDocs.map((doc) => doc.oid),
        );

        // Filter notes for MongoDB insertion
        const notesToInsertMongo = notes.filter(
          (n) => !existingMongoOidSet.has(n.oid),
        );
        if (notesToInsertMongo.length > 0) {
          await mongodbNoteCollection.insertMany(notesToInsertMongo);
        }

        // Sync to Neo4j
        const neo4jNodes = notes.map((note) => ({
          oid: note.oid,
          fileName: note.fileName,
          content: note.content[0]?.fileContent || '',
          metaData: note.metaData || {},
        }));
        await kdbManager.neo4jManager.bulkCreateNodes('Note', neo4jNodes);

        return notes.map((note) => ({
          status: SyncStatus.FULL_SYNC,
          message: 'Synced to MongoDB and Neo4j only',
          recordIds: { oid: note.oid },
        }));
      }
      throw new Error(`Invalid target: ${target}`);
    };

    const results = await bulkAddNoteWithTarget(notesToSync);

    // 6. Log results
    console.log('Synchronization complete.');
    const successCount = results.filter(
      (r) =>
        r.status === SyncStatus.FULL_SYNC ||
        r.status === SyncStatus.PARTIAL_SYNC || // Count partial sync as success for this script's purpose
        r.status === SyncStatus.ALREADY_EXISTS,
    ).length;
    const failedCount = results.filter(
      (r) => r.status === SyncStatus.SYNC_FAILED,
    ).length;

    console.log(`\n--- Sync Summary ---`);
    console.log(`Total Notes Processed: ${results.length}`);
    console.log(`Successful Syncs (Full, Partial, Existed): ${successCount}`);
    console.log(`Failed Syncs: ${failedCount}`);

    if (failedCount > 0) {
      console.log('\nFailed Notes (OIDs):');
      results
        .filter((r) => r.status === SyncStatus.SYNC_FAILED)
        .forEach((r) =>
          console.log(`- OID: ${r.recordIds?.oid}, Reason: ${r.message}`),
        );
    }
    console.log('--------------------\n');
  } catch (error) {
    console.error('An error occurred during the sync process:', error);
    process.exit(1); // Exit with error code
  } finally {
    // Close MongoDB connection if it was established
    // Assuming connectToDatabase doesn't return the client directly to close
    // Add client closing logic if your connectToDatabase utility provides it
    console.log('Sync script finished.');
  }
}

main();
