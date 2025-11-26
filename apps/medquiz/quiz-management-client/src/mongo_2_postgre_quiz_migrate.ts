import { prisma } from 'quiz-db'
import { QuizType } from 'quiz-shared'
import { MongoClient, Db, Collection, WithId } from 'mongodb'
import * as dotenv from 'dotenv'

// Import quiz types from QuizType namespace
type quiz = QuizType.quiz
type A1 = QuizType.A1
type A2 = QuizType.A2
type A3 = QuizType.A3
type B = QuizType.B
type X = QuizType.X
type oid = QuizType.oid

dotenv.config()

// MongoDB connection configuration
const MONGODB_URI = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/'
const MONGODB_DB_NAME = process.env['DB_NAME'] || 'QuizBank'
const MONGODB_COLLECTION_NAME = 'quiz'

// Batch processing configuration
const BATCH_SIZE = 100

/**
 * Connect to MongoDB
 */
async function connectToMongoDB(): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(MONGODB_DB_NAME)
  return { client, db }
}

/**
 * Transform MongoDB quiz data to Prisma format
 */
function transformQuizToPrismaFormat(mongoQuiz: WithId<quiz>) {
  const baseData = {
    id: mongoQuiz._id.toString(),
    type: mongoQuiz.type,
    class: mongoQuiz.class,
    unit: mongoQuiz.unit,
    tags: mongoQuiz.tags,
    analysis: mongoQuiz.analysis as any,
    source: mongoQuiz.source,
    created_at: new Date(),
    updated_at: new Date()
  }

  switch (mongoQuiz.type) {
    case 'A1':
    case 'A2':
      return {
        ...baseData,
        question: mongoQuiz.question,
        options: mongoQuiz.options as any,
        answer: mongoQuiz.answer as any,
        specific_data: null
      }

    case 'A3':
      return {
        ...baseData,
        main_question: mongoQuiz.mainQuestion,
        options: mongoQuiz.subQuizs.flatMap(sub => sub.options) as any,
        answer: mongoQuiz.subQuizs.map(sub => sub.answer) as any,
        specific_data: {
          subQuizs: mongoQuiz.subQuizs
        } as any
      }

    case 'B':
      return {
        ...baseData,
        question: null,
        options: mongoQuiz.options as any,
        answer: mongoQuiz.questions.map(q => q.answer) as any,
        specific_data: {
          questions: mongoQuiz.questions
        } as any
      }

    case 'X':
      return {
        ...baseData,
        question: mongoQuiz.question,
        options: mongoQuiz.options as any,
        answer: mongoQuiz.answer as any,
        specific_data: null
      }

    default:
      throw new Error(`Unknown quiz type: ${(mongoQuiz as any).type}`)
  }
}

/**
 * Check if quiz already exists in PostgreSQL
 */
async function quizExists(quizId: string): Promise<boolean> {
  const existingQuiz = await prisma.quizzes.findUnique({
    where: { id: quizId }
  })
  return existingQuiz !== null
}

/**
 * Migrate a single quiz from MongoDB to PostgreSQL
 */
async function migrateSingleQuiz(mongoQuiz: WithId<quiz>): Promise<boolean> {
  try {
    const quizId = mongoQuiz._id.toString()
    
    // Check if quiz already exists
    if (await quizExists(quizId)) {
      console.log(`Quiz ${quizId} already exists, skipping...`)
      return false
    }

    // Transform data
    const prismaData = transformQuizToPrismaFormat(mongoQuiz)

    // Insert into PostgreSQL
    await prisma.quizzes.create({
      data: prismaData as any
    })

    console.log(`Successfully migrated quiz ${quizId} (${prismaData.type})`)
    return true
  } catch (error) {
    console.error(`Error migrating quiz ${mongoQuiz._id}:`, error)
    return false
  }
}

/**
 * Main migration function
 */
async function migrateQuizzes(): Promise<void> {
  let mongoClient: MongoClient | null = null
  let totalProcessed = 0
  let totalMigrated = 0
  let totalErrors = 0

  try {
    console.log('Starting quiz migration from MongoDB to PostgreSQL...')
    
    // Connect to MongoDB
    const { client, db } = await connectToMongoDB()
    mongoClient = client
    
    const collection: Collection<quiz> = db.collection(MONGODB_COLLECTION_NAME)
    
    // Get total count for progress tracking
    const totalCount = await collection.countDocuments()
    console.log(`Found ${totalCount} quizzes to migrate`)

    // Process in batches
    let skip = 0
    while (skip < totalCount) {
      const batch = await collection
        .find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray()

      console.log(`Processing batch ${Math.floor(skip / BATCH_SIZE) + 1}/${Math.ceil(totalCount / BATCH_SIZE)} (${batch.length} quizzes)`)

      // Process each quiz in the batch
      for (const mongoQuiz of batch) {
        totalProcessed++
        const migrated = await migrateSingleQuiz(mongoQuiz)
        if (migrated) {
          totalMigrated++
        } else {
          totalErrors++
        }
      }

      skip += BATCH_SIZE
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total processed: ${totalProcessed}`)
    console.log(`Successfully migrated: ${totalMigrated}`)
    console.log(`Errors/skipped: ${totalErrors}`)
    console.log('Migration completed!')

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    // Close MongoDB connection
    if (mongoClient) {
      await mongoClient.close()
    }
    
    // Disconnect Prisma
    await prisma.$disconnect()
  }
}

/**
 * Run migration if this file is executed directly
 */
if (require.main === module) {
  migrateQuizzes()
    .then(() => {
      console.log('Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export { migrateQuizzes, transformQuizToPrismaFormat, migrateSingleQuiz }