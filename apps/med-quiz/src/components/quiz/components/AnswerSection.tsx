import React from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { QuizAnalysis } from "./QuizAnalysis";
import { Result } from "../styles/QuizStyles";
import { QuizWithUserAnswer } from "@/types/quizData.types";
import { Check, X as XIcon } from "lucide-react";

interface AnswerSectionProps {
  quiz: QuizWithUserAnswer;
  submitted: boolean;
  isCorrect: boolean;
  subQuestionCorrectness?: Record<number, boolean>;
  getShuffledOptions?: (options: any[], questionId?: string | number) => any[];
}

export const AnswerSection: React.FC<AnswerSectionProps> = ({
  quiz,
  submitted,
  isCorrect,
  subQuestionCorrectness = {},
  getShuffledOptions,
}) => {
  if (!submitted) return null;

  // Helper function to get the actual content of an option by its ID
  const getOptionText = (
    optionId: string,
    options: { oid: string; text: string }[],
  ) => {
    const option = options.find((opt) => opt.oid === optionId);
    return option ? option.text : optionId;
  };

  // Helper function to get shuffled options if available, otherwise use original options
  const getOptionsForQuestion = (
    options: { oid: string; text: string }[],
    questionId?: string | number,
  ) => {
    if (getShuffledOptions) {
      return getShuffledOptions(options, questionId);
    }
    return options;
  };

  const renderAnswer = () => {
    switch (quiz.type) {
      case "A1":
      case "A2":
        // Get correct answer text
        const correctAnswerText = getOptionText(
          quiz.answer as string,
          getOptionsForQuestion(quiz.options),
        );
        // Get user answer text
        const userAnswerSingle = Array.isArray(quiz.userAnswer)
          ? quiz.userAnswer[0]
          : quiz.userAnswer;
        const userAnswerText = userAnswerSingle
          ? getOptionText(userAnswerSingle, getOptionsForQuestion(quiz.options))
          : "未作答";
        const isAnswerCorrect = userAnswerSingle === quiz.answer;

        return (
          <div className="space-y-4">
            <Card className="bg-background text-foreground p-4 space-y-4">
              <CardTitle className="text-lg font-semibold mb-2">
                答案：
              </CardTitle>

              <div className="space-y-2 ml-2">
                <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950">
                  <span className="font-medium mr-2">正确答案：</span>
                  <span>{correctAnswerText.replace(/^[A-E]\.\s*/, "")}</span>
                </div>
                <div
                  className={`flex items-center p-2 rounded ${
                    isAnswerCorrect
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-red-100 dark:bg-red-900"
                  }`}
                >
                  <span className="font-medium mr-2">你的答案：</span>
                  <span>{userAnswerText.replace(/^[A-E]\.\s*/, "")}</span>
                  {isAnswerCorrect ? (
                    <Check
                      size={16}
                      className="ml-auto text-green-600 dark:text-green-400 font-bold"
                    />
                  ) : (
                    <XIcon
                      size={16}
                      className="ml-auto text-red-600 dark:text-red-400 font-bold"
                    />
                  )}
                </div>
              </div>

              <QuizAnalysis
                point={quiz.analysis.point}
                discuss={quiz.analysis.discuss}
                aiAnalysis={quiz.analysis.ai_analysis}
              />
            </Card>
          </div>
        );

      case "X":
        // Get correct answer texts
        const correctAnswerTexts = (quiz.answer as string[]).map((id) =>
          getOptionText(id, getOptionsForQuestion(quiz.options)),
        );
        // Get user answer texts
        const userAnswers = Array.isArray(quiz.userAnswer)
          ? quiz.userAnswer
          : quiz.userAnswer
            ? [quiz.userAnswer]
            : [];
        const userAnswerTexts = userAnswers.map((id) =>
          getOptionText(id, getOptionsForQuestion(quiz.options)),
        );
        const userAnswerTextX =
          userAnswerTexts.length > 0 ? userAnswerTexts.join("、") : "未作答";

        // Check if user's answers match correct answers (order doesn't matter)
        const isXAnswerCorrect =
          userAnswers.length === quiz.answer.length &&
          userAnswers.every((ans) => (quiz.answer as string[]).includes(ans)) &&
          (quiz.answer as string[]).every((ans) => userAnswers.includes(ans));

        return (
          <div className="space-y-4">
            <Card className="bg-background text-foreground p-4 space-y-4">
              <CardTitle className="text-lg font-semibold mb-2">
                答案：
              </CardTitle>

              <div className="space-y-2 ml-2">
                <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950">
                  <span className="font-medium mr-2">正确答案：</span>
                  <span>
                    {correctAnswerTexts
                      .map((text) => text.replace(/^[A-E]\.\s*/, ""))
                      .join("、")}
                  </span>
                </div>
                <div
                  className={`flex items-center p-2 rounded ${
                    isXAnswerCorrect
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-red-100 dark:bg-red-900"
                  }`}
                >
                  <span className="font-medium mr-2">你的答案：</span>
                  <span>{userAnswerTextX.replace(/^[A-E]\.\s*/, "")}</span>
                  {isXAnswerCorrect ? (
                    <Check
                      size={16}
                      className="ml-auto text-green-600 dark:text-green-400 font-bold"
                    />
                  ) : (
                    <XIcon
                      size={16}
                      className="ml-auto text-red-600 dark:text-red-400 font-bold"
                    />
                  )}
                </div>
              </div>

              <QuizAnalysis
                point={quiz.analysis.point}
                discuss={quiz.analysis.discuss}
                links={quiz.analysis.link}
                aiAnalysis={quiz.analysis.ai_analysis}
              />
            </Card>
          </div>
        );

      case "A3":
        return (
          <div className="space-y-4">
            <Card className="bg-background text-foreground p-4 space-y-4">
              <CardTitle className="text-lg font-semibold mb-2">
                各小题答案：
              </CardTitle>
              <div className="space-y-3">
                {(quiz as any).subQuizs.map((subQuiz: any, index: number) => {
                  const userAnswer = (quiz as any).userAnswer?.[
                    subQuiz.subQuizId
                  ];
                  const isSubCorrect =
                    subQuestionCorrectness[subQuiz.subQuizId] ?? false;

                  // Get correct answer text
                  const correctAnswerText = getOptionText(
                    subQuiz.answer,
                    getOptionsForQuestion(subQuiz.options, subQuiz.subQuizId),
                  );

                  // Get user answer text
                  const userAnswerText = userAnswer
                    ? getOptionText(
                        userAnswer,
                        getOptionsForQuestion(
                          subQuiz.options,
                          subQuiz.subQuizId,
                        ),
                      )
                    : "未作答";

                  return (
                    <div
                      key={subQuiz.subQuizId}
                      className="border rounded-lg p-3"
                    >
                      <div className="flex items-start mb-2">
                        <span className="font-medium mr-2">{index + 1}.</span>
                        <span className="flex-1">{subQuiz.question}</span>
                      </div>

                      <div className="ml-6 space-y-1">
                        <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950">
                          <span className="font-medium mr-2">正确答案：</span>
                          <span>
                            {correctAnswerText.replace(/^[A-E]\.\s*/, "")}
                          </span>
                        </div>
                        <div
                          className={`flex items-center p-2 rounded ${
                            isSubCorrect
                              ? "bg-green-100 dark:bg-green-900"
                              : "bg-red-100 dark:bg-red-900"
                          }`}
                        >
                          <span className="font-medium mr-2">你的答案：</span>
                          <span>
                            {userAnswerText.replace(/^[A-E]\.\s*/, "")}
                          </span>
                          {isSubCorrect ? (
                            <Check
                              size={16}
                              className="ml-auto text-green-600 dark:text-green-400 font-bold"
                            />
                          ) : (
                            <XIcon
                              size={16}
                              className="ml-auto text-red-600 dark:text-red-400 font-bold"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <QuizAnalysis
                point={quiz.analysis.point}
                discuss={quiz.analysis.discuss}
                links={quiz.analysis.link}
                aiAnalysis={quiz.analysis.ai_analysis}
              />
            </Card>
          </div>
        );

      case "B":
        return (
          <div className="space-y-4">
            <Card className="bg-background text-foreground p-4 space-y-4">
              <CardTitle className="text-lg font-semibold mb-2">
                各小题答案：
              </CardTitle>
              <div className="space-y-3">
                {(quiz as any).questions.map((question: any, index: number) => {
                  const userAnswer = (quiz as any).userAnswer?.[
                    question.questionId
                  ];
                  const isSubCorrect =
                    subQuestionCorrectness[question.questionId] ?? false;

                  // Get correct answer text
                  const correctAnswerText = getOptionText(
                    question.answer,
                    getOptionsForQuestion(quiz.options, question.questionId),
                  );

                  // Get user answer text
                  const userAnswerText = userAnswer
                    ? getOptionText(
                        userAnswer,
                        getOptionsForQuestion(
                          quiz.options,
                          question.questionId,
                        ),
                      )
                    : "未作答";

                  return (
                    <div
                      key={question.questionId}
                      className="border rounded-lg p-3"
                    >
                      <div className="flex items-start mb-2">
                        <span className="font-medium mr-2">{index + 1}.</span>
                        <span className="flex-1">{question.questionText}</span>
                      </div>

                      <div className="ml-6 space-y-1">
                        <div className="flex items-center p-2 rounded bg-green-50 dark:bg-green-950">
                          <span className="font-medium mr-2">正确答案：</span>
                          <span>
                            {correctAnswerText.replace(/^[A-E]\.\s*/, "")}
                          </span>
                        </div>
                        <div
                          className={`flex items-center p-2 rounded ${
                            isSubCorrect
                              ? "bg-green-100 dark:bg-green-900"
                              : "bg-red-100 dark:bg-red-900"
                          }`}
                        >
                          <span className="font-medium mr-2">你的答案：</span>
                          <span>
                            {userAnswerText.replace(/^[A-E]\.\s*/, "")}
                          </span>
                          {isSubCorrect ? (
                            <Check
                              size={16}
                              className="ml-auto text-green-600 dark:text-green-400 font-bold"
                            />
                          ) : (
                            <XIcon
                              size={16}
                              className="ml-auto text-red-600 dark:text-red-400 font-bold"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <QuizAnalysis
                point={quiz.analysis.point}
                discuss={quiz.analysis.discuss}
                links={quiz.analysis.link}
                aiAnalysis={quiz.analysis.ai_analysis}
              />
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return <>{renderAnswer()}</>;
};
