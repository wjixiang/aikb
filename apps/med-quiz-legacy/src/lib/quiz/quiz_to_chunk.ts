import { connectToDatabase } from '../db/mongodb';
import pLimit from 'p-limit';
import { A1, quiz, QuizWithUserAnswer } from '../../types/quizData.types';
import Logger from '../console/logger';
import { b } from '../../baml_client';
import type { KnowledgePoints, RetrievedDocument } from '@/types/baml';

import { surrealDBClient } from '../../kgrag/database/surrrealdbClient';
import GraphStorage from '../../kgrag/database/graphStorage';
import type { Entity } from '@/types/baml';
import KnowledgeGraphRetriever from '../../kgrag/core/KnowledgeGraphRetriever';
import { ChunkDocument } from '../../kgrag/database/chunkStorage';
import { formQuizContent } from '../utils';
import { RecordId } from 'surrealdb';

interface QuizToChunkResult {
  quizId: string;
  // knowledgePoints: KnowledgePoints[];
  // relatedChunks: Omit<ChunkDocument, 'embedding'>[];
  // relationshipSummary: string;
}

/**
 * 将quiz与chunk直接关联，效果不是很理想(Rerank部分不够完善)
 */
export class QuizConnector {
  private logger: Logger;
  private knowledgeGraphRetriever: KnowledgeGraphRetriever;
  private className: string;
  private source: string;
  private graphStorage?: GraphStorage;

  /**
   * Constructs a new QuizConnector instance.
   * @param knowledgeGraphRetriever - The knowledge graph retriever to use.
   * @param className - The class name for filtering quizzes.
   * @param source - The source for filtering quizzes.
   */
  constructor(
    knowledgeGraphRetriever: KnowledgeGraphRetriever,
    className: string,
    source: string,
  ) {
    this.logger = new Logger('quiz_to_chunk');
    this.knowledgeGraphRetriever = knowledgeGraphRetriever;
    this.className = className;
    this.source = source;
  }

  /**
   * Processes quizzes to extract knowledge points and build a knowledge graph.
   * @returns A promise that resolves to an array of QuizToChunkResult.
   */
  public async process(): Promise<QuizToChunkResult[]> {
    try {
      await this.setupConnections();
      // const quizzes = await this.fetchQuizzes();
      // await this.importQuizzesToSurrealDB(quizzes); // Import quizzes before processing

      const db = await surrealDBClient.getDb();
      const quizzes = (await db.query<quiz[][]>('SELECT * FROM quiz'))[0];
      const results = await this.processQuizzes(quizzes);
      return results;
    } catch (error) {
      this.logger.error(`Error in quiz_to_chunk workflow: ${error}`);
      throw error;
    } finally {
      await this.cleanupConnections();
    }
  }

  /**
   * Sets up database connections, including connecting to SurrealDB and initializing GraphStorage.
   * @returns A promise that resolves when connections are set up.
   */
  private async setupConnections(): Promise<void> {
    this.logger.info('Setting up database connections');
    await surrealDBClient.connect();
    const surrealDb = await surrealDBClient.getDb();
    // Update constructor call to use default table names
    this.graphStorage = new GraphStorage(surrealDb);
  }

  /**
   * Cleans up database connections, including closing the SurrealDB connection.
   * @returns A promise that resolves when connections are cleaned up.
   */
  private async cleanupConnections(): Promise<void> {
    try {
      this.logger.info('Closing SurrealDB connection');
      await surrealDBClient.close();
    } catch (error) {
      this.logger.error(`Error closing SurrealDB connection: ${error}`);
    }
  }

  /**
   * Fetches quizzes from the database based on the class name and source.
   * @returns A promise that resolves to an array of quiz.
   */
  private async fetchQuizzes(): Promise<quiz[]> {
    this.logger.info(
      `Fetching quizzes for class: ${this.className}, source: ${this.source}`,
    );
    const { db } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');
    const quizzes = await quizCollection
      .find({ class: this.className, source: this.source })
      .toArray();
    this.logger.info(`Fetched ${quizzes.length} quizzes`);
    return quizzes;
  }

  /**
   * Imports fetched quizzes into SurrealDB.
   * @param quizzes - An array of quizzes to import.
   * @returns A promise that resolves when all quizzes are imported.
   */
  private async importQuizzesToSurrealDB(quizzes: quiz[]): Promise<void> {
    if (!this.graphStorage) {
      throw new Error('Graph storage not initialized');
    }
    this.logger.info(`Importing ${quizzes.length} quizzes to SurrealDB`);
    for (const quiz of quizzes) {
      try {
        // Use the saveQuiz method to save each quiz
        const savedQuiz = await this.graphStorage.saveQuiz(quiz as any); // Cast to any for now, refine type later if needed
        quiz.surrealRecordId = savedQuiz[0].id;
        this.logger.debug(`Imported quiz ${quiz._id} to SurrealDB`);
      } catch (error) {
        this.logger.error(
          `Error importing quiz ${quiz._id} to SurrealDB: ${error}`,
        );
      }
    }
    this.logger.info('Finished importing quizzes to SurrealDB');
  }

  /**
   * Processes an array of quizzes concurrently using p-limit.
   * @param quizzes - An array of quizzes to process.
   * @returns A promise that resolves to an array of QuizToChunkResult.
   */
  private async processQuizzes(quizzes: quiz[]): Promise<QuizToChunkResult[]> {
    const limit = pLimit(25); // Limit concurrency to 10
    const results: QuizToChunkResult[] = [];

    const processingPromises = quizzes.map((quiz) =>
      limit(async () => {
        try {
          const result = await this.processSingleQuiz(quiz);
          results.push(result);
          return result; // Return result for Promise.all
        } catch (error) {
          this.logger.error(`Error processing quiz ${quiz._id}: ${error}`);
          return null; // Return null for failed processing
        }
      }),
    );

    // Wait for all promises to settle
    await Promise.all(processingPromises);

    // Filter out null results from failed processing
    return results.filter((result) => result !== null) as QuizToChunkResult[];
  }

  /**
   * Processes a single quiz to extract knowledge points and build a knowledge graph.
   * @param quiz - The quiz to process.
   * @returns A promise that resolves to a QuizToChunkResult.
   */
  private async processSingleQuiz(quiz: quiz): Promise<QuizToChunkResult> {
    const agent = new QuizToChunkAgent(
      this.logger,
      this.knowledgeGraphRetriever,
      this.graphStorage,
    );
    return agent.processSingleQuiz(quiz);
  }
}

/**
 * Processes quizzes to extract knowledge points and build a knowledge graph.
 * @param knowledgeGraphRetriever - The knowledge graph retriever to use.
 * @param className - The class name for filtering quizzes.
 * @param source - The source for filtering quizzes.
 * @returns A promise that resolves to an array of QuizToChunkResult.
 */
export async function quiz_to_chunk(
  knowledgeGraphRetriever: KnowledgeGraphRetriever,
  className: string,
  source: string,
): Promise<QuizToChunkResult[]> {
  const processor = new QuizConnector(
    knowledgeGraphRetriever,
    className,
    source,
  );
  return processor.process();
}

class QuizToChunkAgent {
  referenceDocument: {
    document: Omit<ChunkDocument, 'embedding'>;
    score: number;
  }[] = [];

  private logger: Logger;
  private knowledgeGraphRetriever: KnowledgeGraphRetriever;
  private graphStorage?: GraphStorage;

  constructor(
    logger: Logger,
    knowledgeGraphRetriever: KnowledgeGraphRetriever,
    graphStorage?: GraphStorage,
  ) {
    this.logger = logger;
    this.knowledgeGraphRetriever = knowledgeGraphRetriever;
    this.graphStorage = graphStorage;
  }

  /**
   * Processes a single quiz to extract knowledge points and build a knowledge graph.
   * @param quiz - The quiz to process.
   * @returns A promise that resolves to a QuizToChunkResult.
   */
  public async processSingleQuiz(quiz: quiz): Promise<QuizToChunkResult> {
    this.logger.info(`Processing quiz: ${quiz._id}`);

    const explanation = await this.generateOrGetExplanation(quiz);
    // const knowledgePoints = await this.extractKnowledgePoints(quiz, explanation);
    this.referenceDocument = await this.performRAG(explanation);
    console.log(`RAG results: ${JSON.stringify(this.referenceDocument)}`);
    console.log(
      `this.referenceDocument.length: ${this.referenceDocument.length}`,
    );
    // Store ragResults in referenceDocument for unified management
    await this.filterLinkedChunks(quiz, explanation); // Filter the documents in referenceDocument

    // Evaluate document sufficiency
    const quiz_content = formQuizContent(quiz);
    let documentEvaluation = await b.EvaluateDocumentSufficiency(
      quiz_content,
      // Transform referenceDocument to RetrievedDocument[] for the BAML call
      this.referenceDocument.map((chunk) => ({
        content: chunk.document.content,
        metadata: JSON.stringify({ score: chunk.score, id: chunk.document.id }), // Include relevant metadata
      })),
    );
    this.logger.info(
      `Initial document sufficiency evaluation: ${JSON.stringify(documentEvaluation)}`,
    );

    // If documents are not sufficient, perform another RAG call based on the explanation
    if (!documentEvaluation.sufficient) {
      this.logger.info(
        `Documents not sufficient. Performing additional RAG based on explanation: ${documentEvaluation.explanation}`,
      );
      const additionalRagResults = await this.performRAG(
        documentEvaluation.missed_knowledge_point
          .map((e) => e.knowledgePoint + ':' + e.description)
          .join('\n'),
      );
      this.referenceDocument.push(...additionalRagResults); // Append new results

      this.logger.info(
        `Appended ${additionalRagResults.length} additional documents. Total documents: ${this.referenceDocument.length}`,
      );

      await this.filterLinkedChunks(quiz, explanation);
      // Re-evaluate document sufficiency with the appended documents
      documentEvaluation = await b.EvaluateDocumentSufficiency(
        quiz_content,
        this.referenceDocument.map((chunk) => ({
          content: chunk.document.content,
          metadata: JSON.stringify({
            score: chunk.score,
            id: chunk.document.id,
          }),
        })),
      );
      this.logger.info(
        `Re-evaluation document sufficiency: ${JSON.stringify(documentEvaluation)}`,
      );
    }

    // const relatedChunks = this.referenceDocument.map(result => result.document);
    // const linkedChunks = await this.filterLinkedChunks(quiz, relatedChunks); // This line is now redundant
    const relationshipSummary = await this.buildGraphAndSummarize(
      quiz as quiz_surreal,
      explanation,
    ); // Use filtered documents

    return {
      quizId: quiz._id,
    };
  }

  /**
   * Generates or retrieves the explanation for a quiz.
   * @param quiz - The quiz to get the explanation for.
   * @returns A promise that resolves to the explanation string.
   */
  private async generateOrGetExplanation(quiz: quiz): Promise<string> {
    let explanation = quiz.analysis?.discuss || quiz.analysis?.point;
    if (!explanation || explanation === '') {
      this.logger.info(`Generating explanation for quiz ${quiz._id}`);
      explanation = await this.generateExplanation(quiz);
    }
    return explanation;
  }

  /**
   * Generates an explanation for a quiz using a BAML model.
   * @param quiz - The quiz to generate an explanation for.
   * @returns A promise that resolves to the generated explanation string.
   */
  private async generateExplanation(quiz: quiz): Promise<string> {
    try {
      const options =
        'options' in quiz
          ? quiz.options.map((opt) => ({ oid: opt.oid, text: opt.text }))
          : [];

      const answer = this.getQuizAnswer(quiz);

      const explanationResult = await b.GenerateExplanation(
        quiz.type === 'A3' ? quiz.mainQuestion : (quiz as A1).question,
        answer,
        options.map((e) => e.text),
      );

      return explanationResult.explanation;
    } catch (error) {
      this.logger.error(`Error generating explanation: ${error}`);
      return 'Explanation generation failed.';
    }
  }

  /**
   * Gets the answer for a given quiz, handling different quiz types.
   * @param quiz - The quiz to get the answer for.
   * @returns The answer string.
   */
  private getQuizAnswer(quiz: quiz): string {
    if ('answer' in quiz) {
      return Array.isArray(quiz.answer) ? quiz.answer.join(', ') : quiz.answer;
    } else if ('questions' in quiz) {
      return quiz.questions
        .map((q) => `${q.questionId}: ${q.answer}`)
        .join('; ');
    } else if ('subQuizs' in quiz) {
      return quiz.subQuizs
        .map((sq) => `${sq.subQuizId}: ${sq.answer}`)
        .join('; ');
    }
    return '';
  }

  /**
   * Extracts knowledge points from a quiz and its explanation using a BAML model.
   * @param quiz - The quiz to extract knowledge points from.
   * @param explanation - The explanation of the quiz.
   * @returns A promise that resolves to an array of KnowledgePoints.
   */
  private async extractKnowledgePoints(
    quiz: quiz,
    explanation: string,
  ): Promise<KnowledgePoints[]> {
    this.logger.info(`Extracting knowledge points for quiz ${quiz._id}`);

    const textToExtract =
      `Question: ${quiz.type === 'A3' ? quiz.mainQuestion : 'question' in quiz ? quiz.question : ''}\n` +
      `Answer: ${this.getQuizAnswer(quiz)}\n` +
      `Explanation: ${explanation}`;

    try {
      const medicalEntityTypes = [
        'disease',
        'symptom',
        'body_part',
        'organ',
        'tissue',
        'cell',
        'pathology_change',
        'medicine',
        'treatment',
        'surgery',
        'population',
        'examination',
        'diagnosis',
        'etiology',
        'risk_factor',
        'prognosis',
        'complication',
        'differential_diagnosis',
        'prevention',
      ];

      return await b.SummarizeKnowledgePoint(textToExtract, explanation);
    } catch (error) {
      this.logger.error(`Error extracting knowledge points: ${error}`);
      return [];
    }
  }

  /**
   * Performs Retrieval Augmented Generation (RAG) based on extracted knowledge points.
   * @param knowledgePoints - An array of KnowledgePoints to use for RAG.
   * @returns A promise that resolves to an array of related chunks with their scores.
   */
  private async performRAG(explanation: string): Promise<
    {
      document: Omit<ChunkDocument, 'embedding'>;
      score: number;
    }[]
  > {
    const relatedChunks: {
      document: Omit<ChunkDocument, 'embedding'>;
      score: number;
    }[] = [];

    return this.knowledgeGraphRetriever.chunks_retriver(explanation, 10);
  }

  /**
   * Builds a knowledge graph in SurrealDB based on the quiz, knowledge points, and related chunks stored in referenceDocument.
   * Also summarizes the relationships.
   * @param quiz - The quiz object.
   * @param knowledgePoints - An array of extracted KnowledgePoints.
   * @returns A promise that resolves to a summary of the relationships.
   */
  private async buildGraphAndSummarize(
    quiz: quiz_surreal,
    explanation: string,
  ) {
    if (!this.graphStorage) {
      throw new Error('Graph storage not initialized');
    }

    try {
      const db = await surrealDBClient.getDb();

      for (const chunk of this.referenceDocument) {
        console.log(
          `Processing chunk: ${chunk.document.id}, score: ${chunk.score}`,
        );
        await db.insertRelation('quiz_to_chunk', {
          in: quiz.id,
          out: chunk.document.id,
          score: chunk.score,
        });
        // if(quiz.surrealRecordId){
        //     const chunkNode = await this.graphStorage.createEdge(quiz.surrealRecordId, 'has_chunk', chunk.document.id, {score: chunk.score} );
        // }
      }
    } catch (error) {
      this.logger.error(`Error building graph: ${error}`);
      return 'Relationship summary generation failed.';
    }
  }

  /**
   * Summarizes the relationships between a quiz, knowledge points, and related chunks using a BAML model.
   * @param quiz - The quiz object.
   * @param knowledgePoints - An array of extracted knowledge points.
   * @param relatedChunks - An array of related chunks.
   * @returns A promise that resolves to the relationship summary string.
   */
  private async summarizeRelationships(
    quiz: quiz,
    knowledgePoints: Entity[],
    relatedChunks: Omit<ChunkDocument, 'embedding'>[],
  ): Promise<string> {
    try {
      let quizText: string;
      if (quiz.type === 'A1') {
        quizText = `Quiz: ${quiz.question}\nOptions:\n${
          quiz.options?.map((opt) => `${opt.oid}: ${opt.text}`).join('\n') ||
          'None'
        }\nAnswer: ${quiz.answer}`;
      } else if (quiz.type === 'A3') {
        quizText = `Main Question: ${quiz.mainQuestion}\nSub-questions:\n${
          quiz.subQuizs?.map((q, i) => `${i + 1}. ${q.question}`).join('\n') ||
          'None'
        }`;
      } else {
        quizText = JSON.stringify(quiz);
      }

      const summaryResult = await b.SummarizeRelationships(
        quizText,
        knowledgePoints.map((kp) => JSON.stringify(kp)),
        relatedChunks.map((chunk) => JSON.stringify(chunk)),
      );

      return summaryResult.summary;
    } catch (error) {
      this.logger.error(`Error summarizing relationships: ${error}`);
      return 'Relationship summary generation failed.';
    }
  }

  /**
   * Filters chunks that are linked to a specific quiz using an LLM.
   * @param quiz - The quiz to filter chunks for.
   * @returns A promise that resolves to an array of linked ChunkDocument.
   */
  private async filterLinkedChunks(
    quiz: quiz,
    explanation: string,
  ): Promise<void> {
    this.logger.info(`Filtering linked chunks for quiz ${quiz._id}`);
    const quiz_content = formQuizContent(quiz);

    try {
      // Transform referenceDocument to RetrievedDocument[] for the BAML call
      const docs = await this.performRAG(explanation);
      console.log(`docs.length: ${docs.length}`);
      const documentsForBaml = (await this.performRAG(explanation)).map(
        (chunk) => ({
          content: chunk.document.content,
          metadata: JSON.stringify({
            score: chunk.score,
            id: chunk.document.id,
          }), // Include relevant metadata
        }),
      );

      const relevantIndices = await b.FilterRelatedChunks(
        quiz_content,
        documentsForBaml,
      );

      // Filter the original referenceDocument based on the indices
      const filteredChunks = this.referenceDocument.filter((_, index) =>
        relevantIndices.includes(index),
      );
      this.referenceDocument = filteredChunks; // Update referenceDocument with filtered chunks
      this.logger.info(
        `Filtered down to ${this.referenceDocument.length} relevant chunks`,
      );
    } catch (error) {
      this.logger.error(`Error filtering linked chunks: ${error}`);
      // Depending on desired behavior, could re-throw or return empty array
      this.referenceDocument = []; // Clear documents on error
    }
  }
}

type quiz_surreal = quiz & {
  id: RecordId;
};
