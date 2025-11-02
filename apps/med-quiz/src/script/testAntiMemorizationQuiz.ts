import QuizMutate from "../lib/quiz/quiz_mutate/quiz_mutation";
import { quiz, A1 } from "../types/quizData.types";

async function main() {
  console.log("Starting anti-memorization quiz test script...");

  const quizMutate = new QuizMutate();

  // Sample A1 quiz data
  const sampleQuiz: A1 = {
    _id: "sample_quiz_id_123",
    type: "A1",
    class: "医学基础",
    unit: "生理学",
    tags: ["心血管", "生理"],
    question: "下列关于心肌细胞动作电位的叙述，哪项是错误的？",
    options: [
      { oid: "A", text: "A. 0期是Na+快速内流引起" },
      { oid: "B", text: "B. 1期是K+外流引起" },
      { oid: "C", text: "C. 2期是Ca2+内流和K+外流的平衡" },
      { oid: "D", text: "D. 3期是K+快速外流引起复极" },
      { oid: "E", text: "E. 4期是静息电位，由Na+-K+泵维持" },
    ],
    answer: "B",
    analysis: {
      point: "心肌细胞动作电位",
      discuss: "心肌细胞动作电位1期是K+外流引起，但主要由Cl-内流引起。",
      link: [],
    },
    source: "教材",
  };

  console.log("Original Quiz:");
  console.log(JSON.stringify(sampleQuiz, null, 2));

  try {
    const mutatedQuiz =
      await quizMutate.convertToAntiMemorizationQuestion(sampleQuiz);
    console.log("\nMutated Quiz:");
    console.log(JSON.stringify(mutatedQuiz, null, 2));
  } catch (error) {
    console.error("Error during quiz mutation:", error);
  }

  console.log("\nAnti-memorization quiz test script finished.");
}

main();
