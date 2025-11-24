"use client";
import { useState } from "react";
import { Button } from "ui";
import { QuizSelector } from "./quizselector/QuizSelector";
import { QuizType } from "quiz-shared";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import styled from "styled-components";

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizType.QuizWithUserAnswer[],
): QuizType.QuizWithUserAnswer[] => {
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

const PageContainer = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const TitleInput = styled.input`
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  font-size: 18px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const QuizList = styled.ul`
  list-style: none;
  padding: 0;
  margin-bottom: 20px;
`;

const QuizItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #eee;
  margin-bottom: 10px;
  border-radius: 4px;
`;

const QuizTitle = styled.div`
  flex: 1;
`;

export const NewQuizPage = () => {
  const [title, setTitle] = useState("");
  const [quizSet, setQuizSet] = useState<QuizType.quiz[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();

  const handleAddQuiz = (quiz: QuizType.quiz) => {
    setQuizSet([...quizSet, quiz]);
  };

  const handleRemoveQuiz = (index: number) => {
    setQuizSet(quizSet.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || quizSet.length === 0) {
      toast.error("请填写试卷标题并添加题目");
      return;
    }

    if (!session?.user?.email) {
      toast.error("请先登录");
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
          title,
          quizIds: quizSet.map((quiz) => quiz._id),
        }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      const result = await response.json();
      toast.success("试卷创建成功");
      setTitle("");
      setQuizSet([]);
    } catch (error) {
      console.error(error);
      toast.error("保存试卷时出错");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <h1>创建新试卷</h1>
      <TitleInput
        type="text"
        placeholder="试卷标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <QuizSelector
        setQuizzes={(quizzes) =>
          setQuizSet((prev) => sortQuizzesByType([...prev, ...quizzes]))
        }
      />

      {quizSet.length > 0 && (
        <>
          <h2>已添加题目 ({quizSet.length})</h2>
          <QuizList>
            {quizSet.map((quiz, index) => {
              const getQuizDisplayText = () => {
                switch (quiz.type) {
                  case "A1":
                  case "A2":
                  case "X":
                    return quiz.question;
                  case "A3":
                    return quiz.mainQuestion;
                  case "B":
                    return quiz.questions?.[0]?.questionText || "B型题";
                  default:
                    return "未知题型";
                }
              };

              return (
                <QuizItem key={index}>
                  <QuizTitle>{getQuizDisplayText()}</QuizTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveQuiz(index)}
                  >
                    删除
                  </Button>
                </QuizItem>
              );
            })}
          </QuizList>
        </>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !title || quizSet.length === 0}
      >
        {isSubmitting ? "保存中..." : "保存试卷"}
      </Button>
    </PageContainer>
  );
};
