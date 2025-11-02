import QuizStorage from "../lib/quiz/QuizStorage";
import { quizSelector } from "@/types/quizSelector.types";

async function main() {
  const storage = new QuizStorage();

  // Define quiz types we want to test
  const quizTypes = ["A1", "A2", "A3", "B", "X"] as const;

  for (const type of quizTypes) {
    try {
      console.log(`\n=== Testing quiz type: ${type} ===`);

      // Fetch one quiz of this type
      const selector: quizSelector = {
        mode: [type],
        quizNum: 1,
        randomize: true,
        cls: [],
        unit: [],
        source: [],
        extractedYear: [],
      };

      const quizzes = await storage.fetchQuizzes(selector);

      if (quizzes.length === 0) {
        console.log(`No quizzes found for type ${type}`);
        continue;
      }

      const quiz = quizzes[0];
      console.log(`Fetched quiz ID: ${quiz._id}`);

      // Test formQuizContent
      const content = QuizStorage.formQuizContent(quiz, true, true);
      console.log(`Formatted content:\n${content}`);
    } catch (error) {
      console.error(`Error processing type ${type}:`, error);
    }
  }
}

main().catch(console.error);
