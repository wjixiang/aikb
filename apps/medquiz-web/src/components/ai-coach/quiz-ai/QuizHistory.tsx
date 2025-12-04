'use client';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { QuizHistoryItem } from '@/types/quizSet.types';

interface QuizHistoryProps {
  history: QuizHistoryItem[];
  isLoadingHistory: boolean;
  currentPage: number;
  itemsPerPage: number;
  historyDrawerOpen: boolean;
  setHistoryDrawerOpen: (open: boolean) => void;
  loadHistory: () => Promise<void>;
  handleRestoreQuizSet: (quizSetId: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
}

export function QuizHistory({
  history,
  isLoadingHistory,
  currentPage,
  itemsPerPage,
  historyDrawerOpen,
  setHistoryDrawerOpen,
  loadHistory,
  handleRestoreQuizSet,
  setCurrentPage,
}: QuizHistoryProps) {
  const handleDeleteQuizSet = async (
    quizSetId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    if (!confirm('确定要删除这个试卷吗？此操作不可撤销。')) {
      return;
    }

    try {
      const response = await fetch(`/api/quiz/delete/${quizSetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || '删除试卷失败');
      }

      // Reload history after successful deletion
      await loadHistory();
    } catch (error) {
      console.error('Error deleting quiz set:', error);
      alert(error instanceof Error ? error.message : '删除试卷时出错');
    }
  };

  return (
    <Drawer
      open={historyDrawerOpen}
      onOpenChange={setHistoryDrawerOpen}
      repositionInputs={false}
    >
      <DrawerContent>
        <div className="mx-auto w-full max-w-md flex overflow-y-auto">
          <div className="flex-1">
            <DrawerHeader>
              <DrawerTitle>历史试卷</DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              <div className="space-y-2">
                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadHistory}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? '加载中...' : '刷新'}
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
                          className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer relative"
                          onClick={() => handleRestoreQuizSet(item.id)}
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(item.createdAt).toLocaleString()} ·{' '}
                            {item.quizCount}题
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-6 px-2"
                            onClick={(e) => handleDeleteQuizSet(item.id, e)}
                          >
                            删除
                          </Button>
                        </div>
                      ))}
                    {history.length > itemsPerPage && (
                      <div className="flex justify-between items-center mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage(Math.max(1, currentPage - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          上一页
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          第 {currentPage} /{' '}
                          {Math.ceil(history.length / itemsPerPage)} 页
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage(
                              Math.min(
                                Math.ceil(history.length / itemsPerPage),
                                currentPage + 1,
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
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  onClick={() => setHistoryDrawerOpen(false)}
                >
                  关闭
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
