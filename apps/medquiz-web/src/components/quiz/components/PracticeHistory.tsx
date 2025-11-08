import React from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Result } from "../styles/QuizStyles";
import { PracticeRecordData } from "@/lib/quiz/QuizStorage";
import { QuizWithUserAnswer } from "@/types/quizData.types";

interface PracticeHistoryProps {
  submitted: boolean;
  practiceHistory: PracticeRecordData[] | null;
  loading: boolean;
  error: string | null;
  isCorrect: boolean;
  quiz: QuizWithUserAnswer;
  onRefresh?: () => void;
}

export const PracticeHistory: React.FC<PracticeHistoryProps> = ({
  submitted,
  practiceHistory,
  loading,
  error,
  isCorrect,
  quiz,
  onRefresh,
}) => {
  // Helper function to get option text based on quiz type and option ID
  const getOptionText = (optionId: string, questionKey?: number | string) => {
    // For A1/A2/X type questions
    if (quiz.type === "A1" || quiz.type === "A2" || quiz.type === "X") {
      const option = quiz.options.find((opt) => opt.oid === optionId);
      return option ? option.text : optionId;
    }

    // For A3 type questions
    if (quiz.type === "A3" && questionKey !== undefined) {
      const subQuiz = quiz.subQuizs.find(
        (sq) => sq.subQuizId === Number(questionKey),
      );
      if (subQuiz) {
        const option = subQuiz.options.find((opt) => opt.oid === optionId);
        return option ? option.text : optionId;
      }
    }

    // For B type questions
    if (quiz.type === "B" && questionKey !== undefined) {
      const option = quiz.options.find((opt) => opt.oid === optionId);
      return option ? option.text : optionId;
    }

    // Fallback
    return optionId;
  };
  if (!submitted || !practiceHistory) return null;

  return (
    <Card className="mt-4 p-4">
      <CardTitle className="flex items-center justify-between">
        <div className="w-full">
          <Result $isCorrect={isCorrect}>
            {isCorrect ? "回答正确" : "回答错误"}
          </Result>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="ml-2 mt-4 border-none"
          >
            {loading ? "刷新中..." : "刷新"}
          </Button>
        )}
      </CardTitle>
      <CardContent className="p-0">
        {loading && <p>加载练习记录中...</p>}
        {error && <p className="text-red-500">加载失败: {error}</p>}
        {practiceHistory.length === 0 && !loading && <p>没有找到练习记录。</p>}
        {practiceHistory.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">提交时间</TableHead>
                <TableHead>你的答案</TableHead>
                <TableHead className="text-right">结果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practiceHistory.map((record, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {new Date(record.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {Array.isArray(record.selectrecord)
                      ? record.selectrecord
                          .map((id) => getOptionText(id))
                          .join(", ")
                      : typeof record.selectrecord === "object" &&
                          record.selectrecord !== null
                        ? Object.entries(
                            record.selectrecord as Record<string, string>,
                          )
                            .map(
                              ([key, value]) =>
                                `${Number(key) + 1}: ${getOptionText(value, key)}`,
                            )
                            .join(", ")
                        : record.selectrecord === ""
                          ? ""
                          : getOptionText(record.selectrecord as string)}
                  </TableCell>
                  <TableCell className="text-right">
                    {record.correct ? (
                      <span className="text-green-600">正确</span>
                    ) : (
                      <span className="text-red-600">错误</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
