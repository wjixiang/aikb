import { quizAI } from "../lib/quiz/quizAI";
import dotenv from "dotenv";

// Load environment variables - still might be useful if scripts rely on them
dotenv.config();

interface BatchAnnotateParams {
  concurrency?: number;
  class?: string;
  source?: string;
}

interface SingleAnnotateParams {
  quizId: string;
}

interface ListAnnotateParams {
  quizIds: string[];
}

/**
 * Batch annotate quizzes based on filters.
 */
export async function runBatchAnnotation(
  params: BatchAnnotateParams,
): Promise<{ success: boolean; message: string }> {
  console.log("Executing batch annotation via function call...");
  try {
    const processor = new quizAI(params.concurrency); // Use provided concurrency or default
    // Note: quizAI logs progress internally. We might want to capture logs later.
    await processor.batchAnnotate(params.class, params.source);
    console.log("Batch annotation function call completed.");
    // Since batchAnnotate doesn't return detailed status, assume success if no error
    return { success: true, message: "Batch annotation process completed." };
  } catch (error: any) {
    const errorMessage = `Error during batch annotation: ${error.message || error}`;
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }
}

/**
 * Process a single quiz by ID.
 */
export async function runSingleAnnotation(
  params: SingleAnnotateParams,
): Promise<{ success: boolean; message: string }> {
  console.log(
    `Executing single annotation for quiz ID: ${params.quizId} via function call...`,
  );
  if (!params.quizId) {
    return { success: false, message: "Missing quizId parameter." };
  }
  try {
    const processor = new quizAI();
    await processor.processSpecificQuiz(params.quizId);
    console.log(`Single annotation for quiz ID: ${params.quizId} completed.`);
    return {
      success: true,
      message: `Successfully processed quiz ${params.quizId}.`,
    };
  } catch (error: any) {
    const errorMessage = `Error processing quiz ${params.quizId}: ${error.message || error}`;
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }
}

/**
 * Process a list of quiz IDs.
 */
export async function runListAnnotation(
  params: ListAnnotateParams,
): Promise<{ success: boolean; message: string }> {
  console.log(
    `Executing list annotation for ${params.quizIds?.length || 0} quiz IDs via function call...`,
  );
  if (!params.quizIds || params.quizIds.length === 0) {
    return { success: false, message: "Missing or empty quizIds parameter." };
  }
  try {
    const processor = new quizAI();
    // Assuming processQuizList handles logging internally
    await processor.processQuizList(params.quizIds);
    console.log(
      `List annotation for ${params.quizIds.length} quiz IDs completed.`,
    );
    return {
      success: true,
      message: `Successfully processed ${params.quizIds.length} quizzes.`,
    };
  } catch (error: any) {
    const errorMessage = `Error processing quiz list: ${error.message || error}`;
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }
}

// Removed main function and yargs CLI parsing
