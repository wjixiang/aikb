import { MongoClient, ObjectId } from "mongodb";
// Define an interface matching the MongoDB schema for type safety
export interface PracticeRecord {
  // Export the interface
  userid: string;
  quizid: string;
  timestamp: Date;
  selectrecord?: string[]; // Assuming this is optional based on schema
  correct: boolean;
}
import { createLoggerWithPrefix } from "@/lib/console/logger"; // Import the logger factory

const logger = createLoggerWithPrefix("QuizPerformanceService"); // Create a logger instance

export const uri = process.env.MONGODB_URI; // Export uri
export const dbName = process.env.QUIZ_DB; // Export dbName

if (!uri) {
  throw new Error("MONGODB_URI is not defined in environment variables.");
}

if (!dbName) {
  throw new Error("QUIZ_DB is not defined in environment variables.");
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Function to get MongoDB client
export async function getClient(): Promise<MongoClient> {
  // Export getClient
  if (!client) {
    logger.info("Creating new MongoDB client and connecting..."); // Log client creation
    client = new MongoClient(uri!);
    clientPromise = client.connect();
    await clientPromise; // Wait for connection
    logger.info("MongoDB client connected."); // Log successful connection
  } else {
    logger.info("Using existing MongoDB client."); // Log using existing client
  }
  return clientPromise;
}

export interface QuizPerformanceMetrics {
  _id: string; // quizId
  attempts: number;
  correct: number;
  avgTime: number;
}

export async function getQuizPerformanceMetrics(
  userEmail: string,
): Promise<QuizPerformanceMetrics[]> {
  logger.info(`getQuizPerformanceMetrics called for user email: ${userEmail}`); // Log function start
  try {
    const client = await getClient();
    const db = client.db(dbName);
    const collection = db.collection<PracticeRecord>("practicerecords");

    logger.info(
      `Executing MongoDB aggregation for user email: ${userEmail}...`,
    ); // Log before aggregation

    const performanceMetrics = await collection
      .aggregate<QuizPerformanceMetrics>([
        // Match by user email instead of userId
        { $match: { userid: userEmail } },
        {
          $group: {
            _id: "$quizid", // Group by quizid
            attempts: { $sum: 1 },
            correct: { $sum: { $cond: [{ $eq: ["$correct", true] }, 1, 0] } }, // Use 'correct' field
            avgTime: { $avg: "$timestamp" }, // Assuming responseTime is derived from timestamps, this might need adjustment
          },
        },
      ])
      .toArray();

    logger.info(
      `MongoDB aggregation for user email ${userEmail} returned ${performanceMetrics.length} results.`,
    ); // Log after aggregation
    // logger.debug('MongoDB aggregation results:', performanceMetrics); // Optional: log results

    return performanceMetrics;
  } catch (error: any) {
    logger.error("Error in getQuizPerformanceMetrics:", error); // Log the error
    throw error;
  }
}

// You might also want a function to close the client when the application exits
// process.on('SIGINT', async () => {
//   if (client) {
//     await client.close();
//     console.log('MongoDB client disconnected on app termination');
//   }
//   process.exit(0);
// });
