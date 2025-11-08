import { connectToDatabase } from '../lib/db/mongodb';
import { Collection } from 'mongodb';

async function convertTimestamps(collectionName: string) {
  try {
    const { db, client } = await connectToDatabase();
    const collection: Collection = db.collection(collectionName);

    console.log(
      `Starting timestamp conversion for collection: ${collectionName}`,
    );

    const cursor = collection.find({});
    let convertedCount = 0;

    for await (const doc of cursor) {
      if (doc.timestamp && typeof doc.timestamp === 'string') {
        try {
          const date = new Date(doc.timestamp);
          if (!isNaN(date.getTime())) {
            // Check if the date is valid
            await collection.updateOne(
              { _id: doc._id },
              { $set: { timestamp: date } },
            );
            convertedCount++;
            // console.log(`Converted timestamp for document with _id: ${doc._id}`);
          } else {
            console.warn(
              `Invalid date string for document _id: ${doc._id}, timestamp: ${doc.timestamp}`,
            );
          }
        } catch (error) {
          console.error(
            `Error converting timestamp for document _id: ${doc._id}, timestamp: ${doc.timestamp}`,
            error,
          );
        }
      }
    }

    console.log(
      `Finished. Converted ${convertedCount} timestamps in collection: ${collectionName}`,
    );
    client.close();
  } catch (error) {
    console.error('Error during timestamp conversion:', error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(
    'Usage: ts-node src/script/convertTimestamp.ts <collectionName>',
  );
  process.exit(1);
}

const collectionName = args[0];
convertTimestamps(collectionName);
