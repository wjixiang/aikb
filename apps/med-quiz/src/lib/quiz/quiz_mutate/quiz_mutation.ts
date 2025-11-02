import { quiz } from "@/types/quizData.types";
import QuizStorage from "@/lib/quiz/QuizStorage";
import rag_workflow from "@/kgrag/lib/llm_workflow/rag_workflow";
import KnowledgeGraphRetriever from "@/kgrag/core/KnowledgeGraphRetriever";
import { b } from "@/baml_client/async_client";
import { MutatedQuiz, Option as BamlOption } from "@/types/baml.types";
import { language } from "@/kgrag/core/type"; // Import language type
import { KnowledgeGraphRetriever_Config } from "@/setting";

export default class QuizMutate {
  private quizStorage: QuizStorage;
  private kgRetriever: KnowledgeGraphRetriever;

  constructor() {
    this.quizStorage = new QuizStorage();
    this.kgRetriever = new KnowledgeGraphRetriever(
      KnowledgeGraphRetriever_Config,
    );
  }

  async convertToAntiMemorizationQuestion(originalQuiz: quiz): Promise<quiz> {
    // 1. Convert quiz to text
    const quizContent = QuizStorage.formQuizContent(originalQuiz, true);

    // 2. Use RAG to get related documents
    const { bamlDocuments } = await rag_workflow(
      quizContent, // Use the quiz content as the query
      {
        useHyDE: false,
        useHybrid: false,
        topK: 5,
        language: "zh",
      },
    );

    // Convert bamlDocuments to a simple string array for the BAML function
    const relatedChunks = bamlDocuments.map((doc) => doc.content);

    // 3. Use BAML to adjust the quiz
    // Placeholder for similar quizzes - assuming none for now or fetching them later
    const similarQuizzes: string[] = [];

    const mutatedQuiz = await b.GenerateAntiMemorizationQuiz(
      quizContent,
      relatedChunks,
      similarQuizzes,
    );

    const convertedQuiz: quiz = {
      _id: originalQuiz._id, // Keep original ID or generate a new one if it's a truly new quiz
      type:
        originalQuiz.type === "A3" || originalQuiz.type === "B"
          ? "A1"
          : originalQuiz.type, // Default to A1 if original was A3/B, otherwise keep original type
      class: originalQuiz.class,
      unit: originalQuiz.unit,
      tags: originalQuiz.tags,
      question: mutatedQuiz.question,
      options: mutatedQuiz.options.map((opt) => ({
        oid: (opt as any).option_index as any, // Assuming oid can be A, B, C, D, E
        text: (opt as any).option_text,
      })),
      answer: mutatedQuiz.answer[0] as any, // Assuming single answer for A1
      analysis: {
        point: null,
        discuss: mutatedQuiz.explanation,
        ai_analysis: mutatedQuiz.explanation,
        link: [],
      },
      source: originalQuiz.source,
      surrealRecordId: originalQuiz.surrealRecordId,
    };

    return convertedQuiz;
  }
}
