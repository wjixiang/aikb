import { RecordId } from "surrealdb";
import QuizToProperty from "../lib/quiz/quiz_to_property";
import quiz_to_chunk from "@/lib/quiz/quiz_to_chunl_simplify";

async function testQuizToProperty() {
  // Replace with a valid RecordId from your SurrealDB
  const testRecordId = new RecordId("quiz", "vg9vojszz547rd98clhx");

  const quizToProperty = new quiz_to_chunk();

  try {
    console.log(
      `Analyzing quiz and finding documents for RecordId: ${testRecordId}`,
    );
    // const relevantDocuments = await quizToProperty.analyzeQuizAndFindDocuments(testRecordId);
    const relevantDocuments = await quizToProperty.processQuizzes();
    console.log("Relevant Documents:", relevantDocuments);
  } catch (error) {
    console.error("Error testing QuizToProperty:", error);
  }
}

testQuizToProperty();
