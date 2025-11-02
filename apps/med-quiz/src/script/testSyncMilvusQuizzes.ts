import QuizMilvusStorage from "../lib/quiz/QuizMilvusStorage";
import { quizSelector } from "../types/quizSelector.types";
import { createLoggerWithPrefix } from "../lib/console/logger";

const logger = createLoggerWithPrefix("testSyncMilvusQuizzes");

async function main() {
  logger.info("Starting syncQuizzesWithSelector test script for Milvus...");

  const quizStorage = new QuizMilvusStorage({ semantic_search_threshold: 0.7 });

  // Define a sample quizSelector. You might need to adjust this based on your actual data.
  // For example, to sync quizzes from a specific source or with certain tags.
  const selector: quizSelector = {
    cls: ["生理学", "内科学", "外科学", "病理学"],
    mode: [],
    quizNum: 600000,
    unit: [],
    source: [],
    extractedYear: [],
  };

  try {
    await quizStorage.syncQuizzesWithSelector(selector);
    logger.info("syncQuizzesWithSelector completed successfully for Milvus.");
  } catch (error) {
    logger.error(`syncQuizzesWithSelector failed for Milvus: ${error}`);
  } finally {
    // Close Milvus connection if necessary
    // For now, assuming no explicit close is needed for this test script.
  }
}

main().catch((error) => {
  logger.error(`Unhandled error in Milvus test script: ${error}`);
  process.exit(1);
});
