import { connectToDatabase } from "../lib/db/mongodb";
import { ObjectId } from "mongodb";

/**
 * Migration script to add type field to existing tags in quiztags collection
 * Sets default type: "private" for all existing tags
 */
async function migrateTagTypes() {
  try {
    const { db } = await connectToDatabase();
    
    console.log("Starting tag type migration...");
    
    // Update all tags in quiztags collection to add type field
    const result = await db.collection("quiztags").updateMany(
      { "tags.type": { $exists: false } },
      { 
        $set: { 
          "tags.$[].type": "private" 
        } 
      }
    );
    
    console.log(`Migration completed successfully.`);
    console.log(`Modified ${result.modifiedCount} documents.`);
    console.log(`Matched ${result.matchedCount} documents.`);
    
  } catch (error) {
    console.error("Error during tag type migration:", error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateTagTypes()
    .then(() => {
      console.log("Migration finished.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateTagTypes };