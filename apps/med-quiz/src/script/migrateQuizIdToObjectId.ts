import { MongoClient, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/db/mongodb';

async function migrateQuizIdToObjectId() {
  let client: MongoClient | undefined;
  try {
    const { db, client: mongoClient } = await connectToDatabase();
    client = mongoClient;
    const practiceRecordsCollection = db.collection('practicerecords');

    console.log('Starting migration of practicerecords.quizid to ObjectId...');

    const cursor = practiceRecordsCollection.find({
      quizid: { $type: 'string' },
    });

    let migratedCount = 0;
    let errorCount = 0;

    for await (const doc of cursor) {
      try {
        const oldQuizId = doc.quizid;
        // Check if the string is a valid ObjectId format before converting
        if (ObjectId.isValid(oldQuizId)) {
          const newQuizId = new ObjectId(oldQuizId);
          await practiceRecordsCollection.updateOne(
            { _id: doc._id },
            { $set: { quizid: newQuizId } },
          );
          migratedCount++;
          // console.log(`Migrated _id: ${doc._id}, old quizid: ${oldQuizId} to new quizid: ${newQuizId}`);
        } else {
          console.warn(
            `Skipping invalid ObjectId string for _id: ${doc._id}, quizid: ${oldQuizId}`,
          );
          errorCount++;
        }
      } catch (updateError) {
        console.error(
          `Error migrating document _id: ${doc._id}, quizid: ${doc.quizid}:`,
          updateError,
        );
        errorCount++;
      }
    }

    console.log(
      `Migration complete. Successfully migrated ${migratedCount} documents.`,
    );
    if (errorCount > 0) {
      console.warn(
        `Encountered ${errorCount} errors or invalid quizids during migration.`,
      );
    }
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed.');
    }
  }
}

migrateQuizIdToObjectId().catch(console.error);
