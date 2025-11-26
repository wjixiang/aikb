import { QuizType } from 'quiz-shared';
import { b } from '../baml_client/async_client';
import { TextSegmenter } from './TextSegmenter';
import pLimit from 'p-limit';

export type QuizWithoutId = Omit<QuizType.quiz, '_id'>;
import {
  QuestionAnswerPair,
  BasicQuiz,
  QuestionAnswerWithExplanationSlice,
  QuestionAnswerWithExplanationPair,
} from '../baml_client/types';

export class QuizParser {
  private questionsText: TextSegmenter;
  private answersText: string;

  constructor(
    questionsText: string,
    answersText: string,
    concurrencyLimit?: number,
  ) {
    this.questionsText = new TextSegmenter(questionsText);
    this.answersText = answersText;
    if (concurrencyLimit !== undefined) {
      this.concurrencyLimit = concurrencyLimit;
    }
  }

  /**
   * Parse the raw questions and answers into structured quiz data
   * @param config Default values for quiz metadata fields
   */
  private concurrencyLimit: number = 20;

  /**
   * Parse the raw questions and answers into structured quiz data
   * @param config Default values for quiz metadata fields
   */
  async parse(
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizWithoutId[]> {
    const matchedPairs = withExplanation
      ? await this.matchQuestionsAnswersWithExplanation()
      : await this.matchQuestionsAnswers();

    const limit = pLimit(this.concurrencyLimit);
    const transformedQuizzes = await Promise.all(
      matchedPairs.map((basicQuiz) =>
        limit(async () => {
          try {
            return await this.processQuiz(basicQuiz, config, withExplanation);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Unknown error';
            console.error(`Failed to process quiz: ${message}`);
            return null;
          }
        }),
      ),
    );

    const resolvedQuizzes = transformedQuizzes.filter(
      (q) => q !== null,
    ) as QuizWithoutId[];

    if (resolvedQuizzes.length === 0) {
      throw new Error('No valid quizzes could be generated');
    }

    return resolvedQuizzes;
  }

  /**
   * Process individual quiz based on its type
   */
  private async processQuiz(
    basicQuiz: QuestionAnswerPair | QuestionAnswerWithExplanationPair,
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizWithoutId | null> {
    switch (basicQuiz.type) {
      case 'multiple':
        return await this.processMultipleChoiceQuiz(
          basicQuiz,
          config,
          withExplanation,
        );
      case 'share_question':
        return await this.processA3Quiz(basicQuiz, config, withExplanation);
      case 'share_option':
        return await this.processBQuiz(basicQuiz, config, withExplanation);
      default:
        return await this.processBasicQuiz(basicQuiz, config, withExplanation);
    }
  }

  /**
   * Process multiple choice quiz (type QuizType.X)
   */
  private async processMultipleChoiceQuiz(
    basicQuiz: QuestionAnswerPair | QuestionAnswerWithExplanationPair,
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizType.X> {
    const preQuiz =
      withExplanation && 'explanation' in basicQuiz
        ? await b.ConvertToBasicQuiz(
            basicQuiz.question,
            basicQuiz.answer,
            basicQuiz.explanation,
          )
        : await b.ConvertToBasicQuiz(basicQuiz.question, basicQuiz.answer);

    const options = this.createOptions(preQuiz.options);
    const normalizedAnswer = this.normalizeAnswer(preQuiz.answer, options);

    const xQuiz: QuizType.X = {
      _id: '',
      type: 'X',
      class: config?.class ?? preQuiz.clas ?? preQuiz.clas ?? '',
      unit: config?.unit ?? '',
      tags: config?.tags ?? [],
      source: config?.source ?? '',
      question: preQuiz.question,
      options,
      answer: normalizedAnswer as QuizType.oid[],
      analysis: {
        point: config?.analysis?.point ?? null,
        discuss:
          withExplanation && 'explanation' in basicQuiz
            ? (config?.analysis?.discuss ?? preQuiz.explanation ?? null)
            : (config?.analysis?.discuss ?? null),
        ai_analysis: config?.analysis?.ai_analysis,
        link: config?.analysis?.link ?? [],
      },
    };

    const { _id, ...withoutId } = xQuiz;
    return withoutId as QuizType.X;
  }

  /**
   * Process QuizType.A3 quiz (shared questions)
   */
  private async processA3Quiz(
    basicQuiz: QuestionAnswerPair | QuestionAnswerWithExplanationPair,
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizType.A3> {
    const preQuiz =
      withExplanation && 'explanation' in basicQuiz
        ? await b.ConvertToA3Quiz(
            basicQuiz.question,
            basicQuiz.answer,
            basicQuiz.explanation,
          )
        : await b.ConvertToA3Quiz(basicQuiz.question, basicQuiz.answer);

    const a3Quiz: QuizType.A3 = {
      _id: '',
      type: 'A3',
      class: config?.class ?? preQuiz.clas ?? '',
      unit: config?.unit ?? '',
      tags: config?.tags ?? [],
      source: config?.source ?? '',
      mainQuestion: preQuiz.mainQuestion,
      subQuizs: preQuiz.subQuestion.map((e, index) => ({
        subQuizId: index,
        question: e.question,
        options: e.options,
        answer: e.answer as QuizType.oid,
      })),
      analysis: {
        point: config?.analysis?.point ?? null,
        discuss:
          withExplanation && 'explanation' in basicQuiz
            ? (config?.analysis?.discuss ?? preQuiz.explanation ?? null)
            : (config?.analysis?.discuss ?? null),
        ai_analysis: config?.analysis?.ai_analysis,
        link: config?.analysis?.link ?? [],
      },
    };

    return a3Quiz;
  }

  /**
   * Process QuizType.B quiz (shared options)
   */
  private async processBQuiz(
    basicQuiz: QuestionAnswerPair | QuestionAnswerWithExplanationPair,
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizType.B> {
    const preQuiz =
      withExplanation && 'explanation' in basicQuiz
        ? await b.ConvertToBQuiz(
            basicQuiz.question,
            basicQuiz.answer,
            basicQuiz.explanation,
          )
        : await b.ConvertToBQuiz(basicQuiz.question, basicQuiz.answer);

    const bQuiz: QuizType.B = {
      _id: '',
      type: 'B',
      class: config?.class ?? preQuiz.clas ?? '',
      unit: config?.unit ?? '',
      tags: config?.tags ?? [],
      source: config?.source ?? '',
      questions: preQuiz.questions.map((e, index) => ({
        questionId: index,
        questionText: e.question,
        answer: e.answer as QuizType.oid,
      })),
      options: preQuiz.shared_options,
      analysis: {
        point: config?.analysis?.point ?? null,
        discuss:
          withExplanation && 'explanation' in basicQuiz
            ? (config?.analysis?.discuss ?? preQuiz.explanation ?? null)
            : (config?.analysis?.discuss ?? null),
        ai_analysis: config?.analysis?.ai_analysis,
        link: config?.analysis?.link ?? [],
      },
    };

    return bQuiz;
  }

  /**
   * Process basic quiz (A1 or A2)
   */
  private async processBasicQuiz(
    basicQuiz: QuestionAnswerPair | QuestionAnswerWithExplanationPair,
    config?: Partial<QuizType.quiz>,
    withExplanation: boolean = false,
  ): Promise<QuizType.A1 | QuizType.A2> {
    const preQuiz =
      withExplanation && 'explanation' in basicQuiz
        ? await b.ConvertToBasicQuiz(
            basicQuiz.question,
            basicQuiz.answer,
            basicQuiz.explanation,
          )
        : await b.ConvertToBasicQuiz(basicQuiz.question, basicQuiz.answer);

    const options = this.createOptions(preQuiz.options);
    const normalizedAnswer = this.normalizeAnswer(preQuiz.answer, options);

    const aQuiz: QuizType.A1 | QuizType.A2 = {
      _id: '',
      type: config?.type === 'A2' ? 'A2' : 'A1',
      class: config?.class ?? preQuiz.clas ?? '',
      unit: config?.unit ?? '',
      tags: config?.tags ?? [],
      source: config?.source ?? '',
      question: preQuiz.question,
      options,
      answer: normalizedAnswer as QuizType.oid,
      analysis: {
        point: config?.analysis?.point ?? null,
        discuss:
          withExplanation && 'explanation' in basicQuiz
            ? (config?.analysis?.discuss ?? preQuiz.explanation ?? null)
            : (config?.analysis?.discuss ?? null),
        ai_analysis: config?.analysis?.ai_analysis,
        link: config?.analysis?.link ?? [],
      },
    };

    const { _id, ...withoutId } = aQuiz;
    return withoutId as QuizType.A1 | QuizType.A2;
  }

  /**
   * Create options array from string array
   */
  private createOptions(
    optionTexts: string[],
  ): { oid: QuizType.oid; text: string }[] {
    return optionTexts.map((text: string, i: number) => ({
      oid: String.fromCharCode(65 + i) as QuizType.oid,
      text,
    }));
  }

  /**
   * Normalize answer string to valid oid(s)
   */
  private normalizeAnswer(
    answer: string,
    options: { oid: QuizType.oid }[],
  ): QuizType.oid | QuizType.oid[] {
    const validOids = options.map((opt) => opt.oid);
    const answerChars = answer.toUpperCase().split('') as QuizType.oid[];

    if (answerChars.length > 1) {
      const validAnswers = answerChars.filter((char) =>
        validOids.includes(char),
      );
      return validAnswers.length > 0 ? validAnswers : ['A'];
    }

    return validOids.includes(answerChars[0]) ? answerChars[0] : 'A';
  }

  /**
   * Split questions text into individual questions using LLM
   */
  async splitQuestions(): Promise<string[]> {
    return b.SplitQuestions(this.questionsText.text).catch((err) => {
      console.error(`Failed to split questions: ${err.message}`);
      return [];
    });
  }

  /**
   * Pre-process text to mark split points
   */
  private markSplitPoints(text: string): { text: string; splits: number }[] {
    // Split on common question delimiters
    const splitRegex = /([。？！\n]\s*)/g;
    const segments: { text: string; splits: number }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = splitRegex.exec(text)) !== null) {
      const segment = text.substring(lastIndex, match.index + match[0].length);
      segments.push({
        text: segment,
        splits: match.index + match[0].length,
      });
      lastIndex = match.index + match[0].length;
    }

    // Add final segment if text continues after last delimiter
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        splits: text.length,
      });
    }

    return segments;
  }

  /**
   * Match questions with answers using split points
   */
  async matchQuestionsAnswers(): Promise<QuestionAnswerPair[]> {
    const results = await b
      .MatchQuestionsAnswers({
        questions: this.questionsText.renderForLLM(),
        answers: this.answersText,
      })
      .catch((err) => {
        console.error(`Failed to match questions/answers: ${err.message}`);
        return [];
      });

    return results.map((result) => ({
      type: result.type,
      question: this.questionsText.getTextByRange(
        result.question_range[0],
        result.question_range[1],
      ),
      answer: result.answer,
    }));
  }

  async matchQuestionsAnswersWithExplanation(): Promise<
    QuestionAnswerWithExplanationPair[]
  > {
    const answerTextWithMarker = new TextSegmenter(this.answersText);

    const results = await b
      .MatchQuestionsAnswersWithExplanation({
        questions: this.questionsText.renderForLLM(),
        answers: answerTextWithMarker.renderForLLM(),
      })
      .catch((err) => {
        console.error(`Failed to match questions/answers: ${err.message}`);
        return [];
      });

    return results.map((result) => ({
      type: result.type,
      question: this.questionsText.getTextByRange(
        result.question_range[0],
        result.question_range[1],
      ),
      answer: result.answer,
      explanation: answerTextWithMarker.getTextByRange(
        result.answer_range[0],
        result.answer_range[1],
      ),
    }));
  }

  /**
   * Split questions and answers text into smaller chunks for processing
   * @param chunkNum Number of chunks to split the text into
   * @returns Array of QuizParser instances, each representing a chunk
   */
  async chunkInput(chunkNum: number): Promise<QuizParser[]> {
    if (chunkNum <= 1) {
      return [this];
    }

    try {
      // Get the segmented questions and answers text
      const questionsSegmentedText = this.questionsText.renderForLLM();

      // Create TextSegmenter for answers
      const answersSegmenter = new TextSegmenter(this.answersText);
      const answersSegmentedText = answersSegmenter.renderForLLM();

      // Use BAML to split both questions and answers together synchronously
      const chunks = await b.SplitPage(
        questionsSegmentedText,
        answersSegmentedText,
        chunkNum,
      );

      // Create QuizParser instances for each chunk
      const chunkedParsers: QuizParser[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Extract the actual text for this chunk
        const questionsText = this.questionsText.getTextByRange(
          chunk.question.start,
          chunk.question.end,
        );

        // Extract the corresponding answers
        const answersText = chunk.answer
          .map((value, index) => {
            return `${index + 1}. ${value}`;
          })
          .join('\n');

        // Create a new QuizParser instance for this chunk
        const chunkedParser = new QuizParser(
          questionsText,
          answersText,
          this.concurrencyLimit,
        );
        chunkedParsers.push(chunkedParser);
      }

      return chunkedParsers;
    } catch (error) {
      console.error('Failed to chunk input:', error);
      throw new Error(
        `Chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Helper to validate parsed quiz data
   */
  private validateQuiz(quizData: QuizType.quiz): boolean {
    // Basic validation logic

    throw new Error('Not implemented');
  }
}
