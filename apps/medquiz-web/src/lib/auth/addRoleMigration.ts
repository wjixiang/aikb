import { clientPromise } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

async function migrateUserRoles(email?: string) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.QUIZ_DB);
    const usersCollection = db.collection('User');

    // Add role field to all users who don't have it
    const result = await usersCollection.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'user' } },
    );
    console.log(`Added role field to ${result.modifiedCount} users`);

    // Promote specific user to admin if email provided
    if (email) {
      const adminResult = await usersCollection.updateOne(
        { email: email.toLowerCase().trim() },
        { $set: { role: 'admin' } },
      );
      if (adminResult.modifiedCount === 1) {
        console.log(`Promoted ${email} to admin`);
      } else {
        console.log(`User ${email} not found or already admin`);
      }
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get email from command line arguments
const email = process.argv[2];
migrateUserRoles(email);
