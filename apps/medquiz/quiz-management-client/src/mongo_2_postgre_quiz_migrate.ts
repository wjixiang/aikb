import { prisma } from 'quiz-db';
import { QuizType } from 'quiz-shared';
import { MongoClient, Db, Collection, WithId } from 'mongodb';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

// Import quiz types from QuizType namespace
type quiz = QuizType.quiz;
type A1 = QuizType.A1;
type A2 = QuizType.A2;
type A3 = QuizType.A3;
type B = QuizType.B;
type X = QuizType.X;
type oid = QuizType.oid;

dotenv.config();

// MongoDB connection configuration
const MONGODB_URI = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/';
const MONGODB_DB_NAME = process.env['DB_NAME'] || 'QuizBank';
const MONGODB_COLLECTION_NAME = 'quiz';

// Batch processing configuration
const BATCH_SIZE = 100;

/**
 * Connect to MongoDB
 */
async function connectToMongoDB(): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);
  return { client, db };
}

/**
 * Transform MongoDB quiz data to base quizzes table format
 */
function transformBaseQuizData(mongoQuiz: WithId<quiz>) {
  return {
    id: randomUUID(), // Generate a proper UUID for PostgreSQL
    mongo_id_legacy: mongoQuiz._id.toString(), // Store original MongoDB ObjectId
    type: mongoQuiz.type,
    class: mongoQuiz.class,
    unit: mongoQuiz.unit,
    tags: mongoQuiz.tags || [], // Ensure tags is always an array
    source: mongoQuiz.source || null, // Ensure source is null if undefined
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Transform MongoDB quiz data to specific type tables
 */
function transformSpecificQuizData(mongoQuiz: WithId<quiz>, quizId: string) {
  switch (mongoQuiz.type) {
    case 'A1':
    case 'A2':
      return {
        quiz_id: quizId,
        question: mongoQuiz.question || '',
        options: mongoQuiz.options as any,
        answer: mongoQuiz.answer as string,
      };

    case 'A3':
      return {
        quiz_id: quizId,
        main_question: mongoQuiz.mainQuestion || '',
        sub_quizzes: mongoQuiz.subQuizs || ([] as any),
      };

    case 'B':
      return {
        quiz_id: quizId,
        options: mongoQuiz.options as any,
        questions: mongoQuiz.questions || ([] as any),
      };

    case 'X':
      return {
        quiz_id: quizId,
        question: mongoQuiz.question || '',
        options: mongoQuiz.options as any,
        answers: mongoQuiz.answer as string[],
      };

    default:
      throw new Error(`Unknown quiz type: ${(mongoQuiz as any).type}`);
  }
}

/**
 * Transform analysis data
 */
function transformAnalysisData(mongoQuiz: WithId<quiz>, quizId: string) {
  if (!mongoQuiz.analysis) return null;

  const analysis = mongoQuiz.analysis as any;
  return {
    quiz_id: quizId,
    reference: analysis.point || null,
    discuss: analysis.discuss || null,
    ai_analysis: analysis.ai_analysis || null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Check if quiz already exists in PostgreSQL using mongo_id_legacy
 */
async function quizExists(mongoQuiz: WithId<quiz>): Promise<boolean> {
  const existingQuiz = await prisma.quizzes.findFirst({
    where: { mongo_id_legacy: mongoQuiz._id.toString() },
  });
  return existingQuiz !== null;
}

/**
 * Migrate a single quiz from MongoDB to PostgreSQL
 */
async function migrateSingleQuiz(mongoQuiz: WithId<quiz>): Promise<boolean> {
  try {
    const mongoId = mongoQuiz._id.toString();

    // Check if quiz already exists
    if (await quizExists(mongoQuiz)) {
      console.log(
        `Quiz ${mongoId} (${mongoQuiz.type}) already exists, skipping...`,
      );
      return false;
    }

    // Transform base data
    const baseData = transformBaseQuizData(mongoQuiz);
    const specificData = transformSpecificQuizData(mongoQuiz, baseData.id);
    const analysisData = transformAnalysisData(mongoQuiz, baseData.id);

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Insert base quiz data
      await tx.quizzes.create({
        data: baseData,
      });

      // Insert type-specific data
      switch (mongoQuiz.type) {
        case 'A1':
        case 'A2':
          await tx.quiz_single_choice.create({
            data: specificData as any,
          });
          break;

        case 'A3':
          await tx.quiz_share_question.create({
            data: specificData as any,
          });
          break;

        case 'B':
          await tx.quiz_share_option.create({
            data: specificData as any,
          });
          break;

        case 'X':
          await tx.quiz_multiple_choice.create({
            data: specificData as any,
          });
          break;

        default:
          throw new Error(`Unknown quiz type: ${(mongoQuiz as any).type}`);
      }

      // Insert analysis data if exists
      if (analysisData) {
        await tx.quiz_analysis.create({
          data: analysisData,
        });
      }
    });

    console.log(
      `Successfully migrated quiz ${mongoId} -> ${baseData.id} (${baseData.type})`,
    );
    return true;
  } catch (error) {
    const mongoId = mongoQuiz._id.toString();
    if (error instanceof Error) {
      console.error(
        `Error migrating quiz ${mongoId} (${mongoQuiz.type}): ${error.message}`,
      );
      console.error(`Stack trace:`, error.stack);
    } else {
      console.error(
        `Unknown error migrating quiz ${mongoId} (${mongoQuiz.type}):`,
        error,
      );
    }
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateQuizzes(): Promise<void> {
  let mongoClient: MongoClient | null = null;
  let totalProcessed = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  try {
    console.log('Starting quiz migration from MongoDB to PostgreSQL...');

    // Connect to MongoDB
    const { client, db } = await connectToMongoDB();
    mongoClient = client;

    const collection: Collection<quiz> = db.collection(MONGODB_COLLECTION_NAME);

    // Get total count for progress tracking
    const totalCount = await collection.countDocuments();
    console.log(`Found ${totalCount} quizzes to migrate`);

    // Process in batches
    let skip = 0;
    while (skip < totalCount) {
      const batch = await collection
        .find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray();

      console.log(
        `Processing batch ${Math.floor(skip / BATCH_SIZE) + 1}/${Math.ceil(totalCount / BATCH_SIZE)} (${batch.length} quizzes)`,
      );

      // Process each quiz in the batch
      for (const mongoQuiz of batch) {
        totalProcessed++;
        const migrated = await migrateSingleQuiz(mongoQuiz);
        if (migrated) {
          totalMigrated++;
        } else {
          totalErrors++;
        }
      }

      skip += BATCH_SIZE;
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Successfully migrated: ${totalMigrated}`);
    console.log(`Errors/skipped: ${totalErrors}`);
    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    if (mongoClient) {
      await mongoClient.close();
    }

    // Disconnect Prisma
    await prisma.$disconnect();
  }
}

/**
 * Run migration if this file is executed directly
 */
if (require.main === module) {
  migrateQuizzes()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export {
  migrateQuizzes,
  transformBaseQuizData,
  transformSpecificQuizData,
  transformAnalysisData,
  migrateSingleQuiz,
};
