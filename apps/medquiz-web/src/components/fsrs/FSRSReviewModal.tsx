"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { UserSubscription } from "@/types/anki.types";
import Page from "../quiz/QuizPage";
import { note } from "@/types/noteData.types";

interface FSRSReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
}

interface DueCard {
  _id: string;
  cardOid: string;
  state: {
    due: string;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    last_review: string | null;
  };
  title: string;
  collectionName: string;
  collectionId: string;
}

export default function FSRSReviewModal({
  open,
  onOpenChange,
  collectionId,
}: FSRSReviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const { data: session } = useSession();
  const router = useRouter();
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [dueNewCards, setDueNewCards] = useState<DueCard[]>([]);
  const [dueReviewCards, setDueReviewCards] = useState<DueCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [reviewStartTime, setReviewStartTime] = useState<number | null>(null);
  const [collectionState, setCollectionState] =
    useState<UserSubscription | null>(null);

  // Draggable window states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const initialMousePos = useRef({ x: 0, y: 0 });
  const initialWindowPos = useRef({ x: 0, y: 0 });

  const fetchCollectionState = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/fsrs/collections/subscriptions/${collectionId}`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("data", data);
        setCollectionState(data.CollectionSubscription);
        console.log(collectionState);
        if (
          data.CollectionSubscription.dueCount +
            data.CollectionSubscription.reviewCount ===
          0
        ) {
          toast.success("太棒了！当前没有需要复习的卡片。");
          setDueCards([]);
        } else {
          fetchDueCards();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "获取订阅状态失败");
      }
    } catch (error) {
      console.error("获取订阅状态失败:", error);
      toast.error("获取订阅状态失败");
    }
  }, [collectionId]);

  const fetchDueCards = useCallback(async () => {
    try {
      setLoading(true);
      // const response = await fetch(`/api/fsrs/review/due/${collectionId}`);
      const reviewCards = await fetchReviewCards();
      const newCards = await fetchNewCards();

      if (reviewCards && newCards) {
        // 在此处实现学习卡片的排序
        const DueCardList = [...reviewCards, ...newCards];

        setDueCards(DueCardList);
        setCurrentCardIndex(0);
      }
    } catch (error) {
      console.error("获取待复习卡片失败:", error);
      toast.error("获取待复习卡片失败");
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  const fetchReviewCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fsrs/review/due/${collectionId}`);
      if (response.ok) {
        const data: DueCard[] = await response.json();
        setDueReviewCards(data);
        // setCurrentCardIndex(0);
        if (data.length > 0) {
          setReviewStartTime(Date.now());
        }
        return data;
      }
    } catch (error) {
      console.error("获取待复习卡片失败:", error);
      toast.error("获取待复习卡片失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchNewCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fsrs/review/new/${collectionId}`);
      if (response.ok) {
        const data: DueCard[] = await response.json();
        // setCurrentCardIndex(0);
        if (data.length > 0) {
          setReviewStartTime(Date.now());
        }
        console.log("New card data", data);
        setDueNewCards(data);
        return data;
      }
    } catch (error) {
      console.error("获取待新学卡片失败:", error);
      toast.error("获取待新学卡片失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && session) {
      fetchCollectionState();
    }
  }, [open, session, fetchCollectionState]);

  const handleCardRating = async (rating: number) => {
    if (!dueCards.length || currentCardIndex >= dueCards.length) return;

    const currentCard = dueCards[currentCardIndex];
    const elapsedTime = reviewStartTime ? Date.now() - reviewStartTime : 0;

    try {
      setReviewing(true);
      const response = await fetch("/api/fsrs/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardOid: currentCard.cardOid,
          rating,
          elapsedTime,
        }),
      });

      if (response.ok) {
        if (currentCardIndex < dueCards.length - 1) {
          setCurrentCardIndex((prev) => prev + 1);
          setReviewStartTime(Date.now());
        } else {
          toast.success("复习完成", {
            description: "所有待复习的卡片已复习完成！",
          });
          onOpenChange(false);
          fetchCollectionState(); // 重新获取订阅状态
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "提交复习失败");
      }
    } catch (error) {
      console.error("提交复习失败:", error);
      toast.error("提交复习失败", {
        description: "提交复习结果时发生错误，请重试。",
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleCardClick = (title: string) => {
    router.push(`/wiki/${encodeURIComponent(title)}`);
  };

  // Draggable window handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on the header area (not on buttons)
    if ((e.target as HTMLElement).closest(".modal-action")) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    initialWindowPos.current = position;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      e.preventDefault();
      const dx = e.clientX - initialMousePos.current.x;
      const dy = e.clientY - initialMousePos.current.y;

      // 设置上界，确保组件不会超出屏幕顶部
      const minY = 0; // 上界为0，表示不能拖出屏幕顶部
      const maxY = window.innerHeight - 30; // 允许组件拖动到屏幕底部，保留30px可见部分
      const minX = 0; // 左侧边界，可以根据需要调整
      const maxX = window.innerWidth - 30; // 允许组件拖动到屏幕右侧，保留30px可见部分

      setPosition({
        x: Math.min(Math.max(minX, initialWindowPos.current.x + dx), maxX),
        y: Math.min(Math.max(minY, initialWindowPos.current.y + dy), maxY),
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
  };

  const getBoundedPosition = (x: number, y: number) => {
    const modalWidth = 550;
    const modalHeight = 800;
    const maxX = window.innerWidth - modalWidth;
    const maxY = window.innerHeight - modalHeight;

    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  useEffect(() => {
    // 只在组件首次打开时设置初始位置，不要在每次重新渲染时都重置
    if (open && position.x === 0 && position.y === 0) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 将初始位置设置在屏幕上方而不是中间
      const topPosition = Math.max(20, Math.round(viewportHeight * 0.15));
      const centerX = Math.max(20, Math.round(viewportWidth / 2) - 275);

      const boundedPos = getBoundedPosition(centerX, topPosition);
      setPosition(boundedPos);
    }

    if (isDragging) {
      // 添加全局事件监听器
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open, isDragging, handleMouseMove, handleMouseUp]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFullscreen) {
      const boundedPos = getBoundedPosition(position.x, position.y);
      setPosition(boundedPos);
    }
    setIsFullscreen(!isFullscreen);
  };

  console.log("Modal props:", { open, collectionId });

  // 处理 Cards to Quizes
  const [quizzes, setquizzes] = useState([]);
  const [quiz_ids, setQuiz_ids] = useState([]);

  const fetchQuiz = async (title: string) => {
    const noteResponse = await fetch(`/api/note/fetch?title=${title}`);
    const note: note = await noteResponse.json();
    console.log(note);
    const data = await fetch("/api/obcors/quiz/similar-search-by-desc", {
      method: "POST",
      body: JSON.stringify({
        filter: 'cls like \"内科学\"',
        searchStr:
          note.fileName +
          "\n" +
          note.content[note.content.length - 1].fileContent,
      }),
    });

    const quizData = await data.json();

    console.log("quizData", data);

    setquizzes(quizData);
  };

  // const handleFetchQuiz = (title: string) => {
  //   fetchQuiz(title)
  // }

  console.log("Modal rendering with:", { open, position, isFullscreen });

  if (!open || !mounted) {
    console.log("Modal not rendering due to !open or !mounted");
    return null;
  }

  const modalContent = (
    <div
      ref={dragRef}
      style={{
        position: "fixed",
        top: isFullscreen ? 0 : position.y, // 直接使用position.y，不要根据isDragging或其他条件重置
        left: isFullscreen ? 0 : position.x, // 直接使用position.x
        width: isFullscreen ? "100%" : "550px",
        // maxHeight: isFullscreen ? '100%' : '80vh',
        backgroundColor: "white",
        borderRadius: isFullscreen ? 0 : "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 9999, // 增加z-index确保在最上层
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "box-shadow 0.2s ease", // 只对阴影添加过渡效果，不要对位置添加
      }}
    >
      {/* Header/Dragable area */}
      <div
        className="p-3 border-b bg-primary text-primary-foreground cursor-move flex items-center justify-between" // 添加背景色以区分头部
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center">
          <Brain className="mr-2" />
          <h2 className="text-lg font-semibold">FSRS 间隔复习</h2>
        </div>
        <div className="flex space-x-2 modal-action">
          <button
            className="p-1 rounded-full hover:bg-primary-foreground/20"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            className="p-1 rounded-full hover:bg-primary-foreground/20"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">正在加载复习卡片...</p>
          </div>
        ) : !collectionState ? null : collectionState?.newCardsCount +
            collectionState?.reviewCardsCount ===
          0 ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <p className="text-xl font-medium mb-2">太棒了！</p>
            <p className="text-muted-foreground text-center mb-4">
              当前没有需要复习的卡片。
              <br />
              您可以在FSRS管理页面订阅更多牌组。
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                fetchNewCards(); // 现在可以获取新学卡片
              }}
            >
              获取新学卡片
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-xl"
                  onClick={() =>
                    handleCardClick(dueCards[currentCardIndex].title)
                  }
                >
                  <p className="hover:underline cursor-pointer">
                    {dueCards[currentCardIndex].title}
                  </p>
                </CardTitle>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {currentCardIndex + 1} / {dueCards.length}
                  </span>
                  <div className="text-sm text-muted-foreground">
                    <span>
                      稳定性:{" "}
                      {dueCards[currentCardIndex].state.stability.toFixed(1)}
                    </span>
                    <span className="mx-2">|</span>
                    <span>
                      难度:{" "}
                      {dueCards[currentCardIndex].state.difficulty.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {collectionState.collectionName}
                  </span>
                </div>
              </CardHeader>
              {/* {quizzes.length == 0 && (
                <Button 
                  onClick={() => fetchQuiz(dueCards[currentCardIndex].title)}
                  className='p-10'
                >
                  获取相关试题
                </Button>
              )} */}
              {/* <div>
                <Page quizSet={quizzes}  />
              </div> */}
              <CardFooter className="pt-0">
                <div className="w-full space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleCardRating(1)}
                      disabled={reviewing}
                    >
                      困难 (1) - {reviewing ? "计算中..." : "10分钟"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleCardRating(2)}
                      disabled={reviewing}
                    >
                      一般 (2) - {reviewing ? "计算中..." : "1天"}
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleCardRating(3)}
                      disabled={reviewing}
                    >
                      简单 (3) - {reviewing ? "计算中..." : "3天"}
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-green-500 text-white hover:bg-green-600 hover:text-white"
                      onClick={() => handleCardRating(4)}
                      disabled={reviewing}
                    >
                      熟悉 (4) - {reviewing ? "计算中..." : "7天"}
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
