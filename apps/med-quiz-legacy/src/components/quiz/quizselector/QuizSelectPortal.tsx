"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuizFilterPanel from "@/components/filter/QuizFilterPanel";
import { QuizSelector } from "./QuizSelector";
import { quiz, answerType, QuizWithUserAnswer } from "@/types/quizData.types";
import { useState, useEffect, useRef, SetStateAction } from "react";
import Page from "../QuizPage";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizWithUserAnswer[],
): QuizWithUserAnswer[] => {
  const typeOrder: Record<string, number> = {
    A1: 0,
    A2: 0,
    A3: 1,
    B: 2,
    X: 3,
  };

  return [...quizzes].sort((a, b) => {
    const orderA = typeOrder[a.type] ?? 999;
    const orderB = typeOrder[b.type] ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return 0; // Maintain original order for same types
  });
};

interface QuizHistoryItem {
  id: string;
  title: string;
  createdAt: Date;
  quizCount: number;
}

type Props = {};

export function QuizSelectPortal() {
  const [quizzes, setQuizzes] = useState<QuizWithUserAnswer[]>([]);
  const [currentQuizSetId, setCurrentQuizSetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const { data: session } = useSession();

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => setNotificationVisible(false), 3000);
  };

  const addQuizToPage = (quiz: QuizWithUserAnswer[]) => {
    setQuizzes((prev) => sortQuizzesByType([...prev, ...quiz]));
  };

  const handleRemoveQuiz = (index: number) => {
    setQuizzes(quizzes.filter((_, i) => i !== index));
  };
  const handleSubmit = async () => {
    if (!session?.user?.email) {
      showNotification("请先登录", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/quiz/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: Date.now().toString(),
          quizIds: quizzes.map((quiz) => quiz._id),
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      const result = await response.json();
      setCurrentQuizSetId(result.id);
      showNotification("试卷创建成功", "success");
    } catch (error) {
      console.error(error);
      showNotification("保存试卷时出错", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!session?.user?.email || !currentQuizSetId) {
      return;
    }

    try {
      const response = await fetch("/api/quiz/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizSetId: currentQuizSetId,
          quizIds: quizzes.map((quiz) => quiz._id),
        }),
      });

      if (!response.ok) {
        throw new Error("更新失败");
      }

      console.log("Quiz set updated successfully");
    } catch (error) {
      console.error("Error updating quiz set:", error);
    }
  };

  const prevQuizzesRef = useRef<quiz[]>([]);

  useEffect(() => {
    if (
      !isRestoring &&
      quizzes.length > 0 &&
      prevQuizzesRef.current.length === 0
    ) {
      handleSubmit();
    } else if (
      !isRestoring &&
      quizzes.length > 0 &&
      prevQuizzesRef.current.length !== quizzes.length
    ) {
      handleUpdate();
    }
    // 当quizzes变化且不是初始加载或恢复时，自动折叠Tabs
    if (prevQuizzesRef.current.length > 0 && !isRestoring) {
      setIsTabsExpanded(false);
    }
    prevQuizzesRef.current = quizzes;
    setIsRestoring(false); // 重置恢复状态
  }, [quizzes]);

  const loadHistory = async () => {
    if (!session?.user?.email) {
      showNotification("请先登录", "error");
      return;
    }

    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/quiz/history");
      if (!response.ok) {
        throw new Error("加载历史试卷失败");
      }
      const result = await response.json();
      setHistory(result.data);
    } catch (error) {
      console.error(error);
      showNotification("加载历史试卷时出错", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRestoreQuizSet = async (quizSetId: string) => {
    setIsRestoring(true); // 标记为恢复状态
    try {
      const response = await fetch(`/api/quiz/create/${quizSetId}`);
      if (!response.ok) {
        throw new Error("恢复试卷失败");
      }
      const result = await response.json();
      setCurrentQuizSetId(quizSetId);
      setQuizzes(
        sortQuizzesByType(
          result.data.quizzes.map((q: any) => {
            const quizWithAnswer = {
              ...q.quiz,
              userAnswer: q.answer || null,
            };
            console.log("Restored quiz:", quizWithAnswer);
            return quizWithAnswer;
          }),
        ),
      );
      showNotification("试卷恢复成功", "success");
    } catch (error) {
      console.error(error);
      showNotification("恢复试卷时出错", "error");
    }
  };

  const handleAnswerChange = async (quizId: string, answer: answerType) => {
    if (!session?.user?.email) {
      showNotification("请先登录", "error");
      return;
    }

    console.log("Attempting to save answer:", { quizId, answer });

    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quizId, answer, quizSetId: currentQuizSetId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Answer save failed:", {
          status: response.status,
          error: result.error,
          code: result.code,
        });

        let errorMessage = "保存答案失败";
        if (result.code === "QUIZ_NOT_FOUND") {
          errorMessage = "题目不存在或不属于当前用户";
        } else if (response.status === 400) {
          errorMessage = `无效的题目ID: ${quizId}`;
        }

        throw new Error(result.error || errorMessage);
      }

      // 更新本地状态以保持与子组件同步
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((quiz) =>
          quiz._id === quizId ? { ...quiz, userAnswer: answer } : quiz,
        ),
      );

      showNotification("答案保存成功", "success");
    } catch (error) {
      console.error("保存答案时出错:", {
        quizId,
        error,
        user: session.user?.email,
      });

      if (error instanceof Error) {
        showNotification(error.message, "error");
      } else {
        showNotification("保存答案时发生未知错误", "error");
      }
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      loadHistory();
    }
  }, [session]);

  const [isTabsExpanded, setIsTabsExpanded] = useState(true);

  return (
    <div className="relative w-full space-y-4">
      <div className="flex justify-between mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuizzes([]);
            showNotification("已重置所有题目", "success");
          }}
          disabled={quizzes.length === 0}
        >
          重置
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsTabsExpanded(!isTabsExpanded)}
          className="text-muted-foreground"
        >
          {isTabsExpanded ? "收起" : "展开"}
        </Button>
      </div>
      <motion.div
        initial={false}
        animate={{
          height: isTabsExpanded ? "auto" : 0,
          opacity: isTabsExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <Tabs defaultValue="filter" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="filter">高级筛选</TabsTrigger>
            <TabsTrigger value="selector">章节模式</TabsTrigger>
            <TabsTrigger value="history">历史试卷</TabsTrigger>
          </TabsList>
          <TabsContent value="filter">
            <QuizFilterPanel
              setQuizzes={addQuizToPage}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </TabsContent>
          <TabsContent value="selector">
            <QuizSelector setQuizzes={addQuizToPage} />
          </TabsContent>
          <TabsContent value="history">
            <div className="space-y-2">
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "加载中..." : "刷新"}
                </Button>
              </div>
              {isLoadingHistory ? (
                <div className="text-center py-4">加载中...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-4">暂无历史试卷</div>
              ) : (
                <div className="space-y-2">
                  {history
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleRestoreQuizSet(item.id)}
                      >
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(item.createdAt).toLocaleString()} ·{" "}
                          {item.quizCount}题
                        </div>
                      </div>
                    ))}
                  {history.length > itemsPerPage && (
                    <div className="flex justify-between items-center mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        上一页
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        第 {currentPage} /{" "}
                        {Math.ceil(history.length / itemsPerPage)} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(
                              Math.ceil(history.length / itemsPerPage),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          currentPage >=
                          Math.ceil(history.length / itemsPerPage)
                        }
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      <div className="justify-center">
        <Page
          quizSet={quizzes}
          onAnswerChange={handleAnswerChange}
          initialAnswers={quizzes.reduce(
            (acc, quiz) => {
              if (quiz.userAnswer !== undefined) {
                acc[quiz._id] = quiz.userAnswer;
              }
              return acc;
            },
            {} as Record<string, answerType>,
          )}
          setQuizSet={function (
            value: SetStateAction<QuizWithUserAnswer[]>,
          ): void {
            throw new Error("Function not implemented.");
          }}
        />
      </div>

      <AnimatePresence>
        {notificationVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-sm shadow-md z-50 ${
              notification.type === "error"
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            <div className="flex items-center">
              {isSubmitting && (
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
