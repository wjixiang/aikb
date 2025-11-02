import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "Please add your MongoDB URI to environment variables (MONGODB_URI)",
  );
}

const dbName = process.env.QUIZ_DB || "QuizBank";

async function initChatCollections() {
  const client = new MongoClient(uri as string);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);

    // Create chat_sessions collection with indexes
    const chatSessions = db.collection("chat_sessions");

    // Create indexes for performance
    await chatSessions.createIndex({ userId: 1, lastActivity: -1 });
    await chatSessions.createIndex(
      { sessionId: 1, userId: 1 },
      { unique: true },
    );
    await chatSessions.createIndex({ userId: 1, status: 1 });

    console.log("Created indexes for chat_sessions collection");

    // Verify collection exists
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (!collectionNames.includes("chat_sessions")) {
      await db.createCollection("chat_sessions");
      console.log("Created chat_sessions collection");
    } else {
      console.log("chat_sessions collection already exists");
    }

    console.log("Database initialization completed successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  initChatCollections()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initChatCollections };
