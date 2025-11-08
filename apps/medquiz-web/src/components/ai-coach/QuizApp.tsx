"use client";

import { useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { UnifiedTabs } from "@/components/ai-coach/UnifiedTabs";
import { UnifiedTabsRef } from "@/components/ai-coach/UnifiedTabsTypes";
import { TabType } from "@/components/ai-coach/UnifiedTabsTypes";
import { DocumentSearchCommand } from "./DocumentSearchCommand";
import AssistantSidebar from "@/components/ai-coach/AssistantSidebar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { QuizHistory } from "./quiz-ai/QuizHistory";
import { QuizSelectorDrawer } from "./quiz-ai/QuizSelectorDrawer";
import { QuizFilterDrawer } from "./quiz-ai/QuizFilterDrawer";
import { useQuizAI } from "./quiz-ai/useQuizAI";
import { NotificationState } from "./quiz-ai/types";
import { SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { formQuizContent } from "@/lib/utils";

const itemsPerPage = 5;

export default function QuizApp() {
  const [isTestMode, setIsTestMode] = useState(false);
  const [quizContentForInput, setQuizContentForInput] = useState<string | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(400); // Default sidebar width
  const assistantSidebarRef = useRef<{
    setIsMobileOpen: (isOpen: boolean) => void;
  } | null>(null);
  const quizTabsRef = useRef<UnifiedTabsRef | null>(null);
  const [documentSearchOpen, setDocumentSearchOpen] = useState(false);

  const {
    // State
    isInitializing,
    isLoading,
    loadingOperation,
    currentQuizSetId,
    history,
    isLoadingHistory,
    isRestoring,
    notification,
    notificationVisible,
    currentPage,
    selectedQuizIndex,
    filterDrawerOpen,
    selectorDrawerOpen,
    historyDrawerOpen,
    quizStateUpdateTrigger,

    // Actions
    setCurrentQuizSetId,
    setSelectedQuizIndex,
    setFilterDrawerOpen,
    setSelectorDrawerOpen,
    setHistoryDrawerOpen,
    setCurrentPage,
    showNotification,
    handleSubmit,
    handleUpdate,
    handleAnswerChange,
    loadHistory,
    handleRestoreQuizSet,
    sendCurrentQuizToChat,
    setQuizStateUpdateTrigger,
  } = useQuizAI();

  const handleRestoreQuizSetWithTabs = async (quizSetId: string) => {
    // First, get the quizzes from the history
    try {
      const response = await fetch(`/api/quiz/create/${quizSetId}`);
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || "恢复试卷失败");
      }
      const result = await response.json();
      const quizzes = result.data.quizzes.map((q: any) => ({
        ...q.quiz,
        userAnswer: q.answer || null,
      }));

      // Set the current quiz set ID to restore the original quiz set
      setCurrentQuizSetId(quizSetId);
      
      // Create a new tab with the restored quizzes but don't create a new quiz set
      quizTabsRef.current?.createTabWithQuizzes(quizzes, result.data.title, false);

      showNotification("试卷恢复成功", "success");
    } catch (error) {
      console.error(error);
      showNotification(
        error instanceof Error ? error.message : "恢复试卷时出错",
        "error",
      );
    }
  };

  if (isInitializing) {
    return (
      <div className="h-full flex flex-col pt-4 pb-1">
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-[200px]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[220px]" />
          </div>
          <div className="flex space-x-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-4 pb-1">
      <AssistantSidebar
        ref={assistantSidebarRef}
        hasSelectedQuiz={selectedQuizIndex !== null}
        quizContentForInput={quizContentForInput}
        onOpenMobileSidebar={() => {
          // This will be called when the mobile sidebar is opened
        }}
        onSidebarWidthChange={setSidebarWidth}
      >
        <SidebarInset className="h-full flex flex-col min-w-0">
          <div className="flex justify-between items-center w-full pt-1 flex-shrink-0">
            <Menubar className="border-0">
              <MenubarMenu>
                <SidebarTrigger />
                <MenubarTrigger>试题选择</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem
                    onClick={() => {
                      setFilterDrawerOpen(true);
                      setSelectorDrawerOpen(false);
                      setHistoryDrawerOpen(false);
                      setDocumentSearchOpen(false);
                    }}
                  >
                    高级筛选
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      setSelectorDrawerOpen(true);
                      setFilterDrawerOpen(false);
                      setHistoryDrawerOpen(false);
                      setDocumentSearchOpen(false);
                    }}
                  >
                    章节模式
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      setHistoryDrawerOpen(true);
                      setFilterDrawerOpen(false);
                      setSelectorDrawerOpen(false);
                      setDocumentSearchOpen(false);
                    }}
                  >
                    历史试卷
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger>文档</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem
                    onClick={() => {
                      setDocumentSearchOpen(true);
                      setFilterDrawerOpen(false);
                      setSelectorDrawerOpen(false);
                      setHistoryDrawerOpen(false);
                    }}
                  >
                    搜索文档
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      quizTabsRef.current?.addTab(TabType.DOCUMENT);
                    }}
                  >
                    新建文档
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <QuizFilterDrawer
                filterDrawerOpen={filterDrawerOpen}
                setFilterDrawerOpen={setFilterDrawerOpen}
                addQuizToPage={(quizzes) =>
                  quizTabsRef.current?.createTabWithQuizzes(quizzes, `新试卷-${new Date().toLocaleString("zh-CN")}`)
                }
                createNewTab={(quizzes, title) =>
                  quizTabsRef.current?.createTabWithQuizzes(quizzes, title)
                }
                loadingOperation={loadingOperation}
                setLoadingOperation={(op) => {}}
              />

              <QuizSelectorDrawer
                selectorDrawerOpen={selectorDrawerOpen}
                setSelectorDrawerOpen={setSelectorDrawerOpen}
                addQuizToPage={(quizzes) =>
                  quizTabsRef.current?.createTabWithQuizzes(quizzes, `新试卷-${new Date().toLocaleString("zh-CN")}`)
                }
              />

              <QuizHistory
                history={history}
                isLoadingHistory={isLoadingHistory}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                historyDrawerOpen={historyDrawerOpen}
                setHistoryDrawerOpen={setHistoryDrawerOpen}
                loadHistory={loadHistory}
                handleRestoreQuizSet={handleRestoreQuizSetWithTabs}
                setCurrentPage={setCurrentPage}
              />

              <MenubarMenu>
                <MenubarTrigger>操作</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem
                    onClick={() => {
                      // Reset functionality is now handled within QuizTabs
                      // We can't easily access the active tab's quiz count here
                      // This functionality would need to be re-implemented if needed
                    }}
                    disabled={true}
                  >
                    清空试题
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      const currentQuizzes =
                        quizTabsRef.current?.getCurrentTabQuizzes() || [];
                      if (currentQuizzes.length === 0) {
                        showNotification("请先添加试题", "error");
                        return;
                      }
                      const title = prompt("请输入试卷标题:");
                      if (title !== null) {
                        handleSubmit(currentQuizzes, title);
                      }
                    }}
                    disabled={false}
                  >
                    保存试卷
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem
                    onClick={() => {
                      // Get the quiz content without answers
                      const quizContent = quizTabsRef.current?.getCurrentQuiz();
                      // Set the quiz content in the input box
                      if (quizContent)
                        setQuizContentForInput(formQuizContent(quizContent));
                      // Open the mobile sidebar
                      assistantSidebarRef.current?.setIsMobileOpen(true);
                    }}
                    disabled={selectedQuizIndex === null}
                  >
                    发送到AI助手（不带答案）
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      // Get the quiz content with answers
                      const quizContent = quizTabsRef.current?.getCurrentQuiz();
                      // Set the quiz content in the input box
                      if (quizContent)
                        setQuizContentForInput(
                          formQuizContent(quizContent, true),
                        );
                      // Open the mobile sidebar
                      assistantSidebarRef.current?.setIsMobileOpen(true);
                    }}
                    disabled={selectedQuizIndex === null}
                  >
                    发送到AI助手（带答案）
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>

              <MenubarMenu>
                <MenubarTrigger>
                  {isTestMode ? "测试模式" : "练习模式"}
                </MenubarTrigger>
                <MenubarContent>
                  <MenubarItem onClick={() => setIsTestMode(!isTestMode)}>
                    切换到{isTestMode ? "练习模式" : "测试模式"}
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden w-full">
            <UnifiedTabs
              ref={quizTabsRef}
              onAnswerChange={handleAnswerChange}
              showNotification={showNotification}
              currentQuizSetId={currentQuizSetId || undefined}
              loadingOperation={loadingOperation}
              setSelectedQuizIndex={setSelectedQuizIndex}
              isTestMode={isTestMode}
              quizStateUpdateTrigger={quizStateUpdateTrigger}
              handleSubmit={handleSubmit}
              onOpenDocument={(path) => {
                quizTabsRef.current?.createTabWithDocument(path);
              }}
            />
          </div>
        </SidebarInset>
      </AssistantSidebar>

      <DocumentSearchCommand
        open={documentSearchOpen}
        onOpenChange={setDocumentSearchOpen}
        onSelectResult={(result) => {
          quizTabsRef.current?.createTabWithDocument(result.path, result.title);
        }}
      />

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
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
