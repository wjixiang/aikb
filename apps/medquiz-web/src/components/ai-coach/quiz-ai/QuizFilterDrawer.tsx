"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import QuizFilterPanel from "@/components/filter/QuizFilterPanel";
import { useQuizAI } from "./useQuizAI";

interface QuizFilterDrawerProps {
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: (open: boolean) => void;
  addQuizToPage: (quizzes: any[]) => void;
  createNewTab?: (quizzes: any[], title?: string) => void;
  loadingOperation: string | null;
  setLoadingOperation: (operation: string | null) => void;
}

export function QuizFilterDrawer({
  filterDrawerOpen,
  setFilterDrawerOpen,
  addQuizToPage,
  createNewTab,
  loadingOperation,
  setLoadingOperation,
}: QuizFilterDrawerProps) {
  return (
    <Drawer
      open={filterDrawerOpen}
      onOpenChange={setFilterDrawerOpen}
      repositionInputs={false}
    >
      <DrawerContent
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="max-w-4xl mx-auto sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-4xl"
      >
        <div
          className="flex flex-col h-[85vh] max-h-[800px] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto">
            <QuizFilterPanel
              setQuizzes={addQuizToPage}
              setIsLoading={(loading) => {
                setLoadingOperation(loading ? "filter" : null);
              }}
              isLoading={loadingOperation === "filter"}
              createNewTab={createNewTab}
            />
          </div>
          <DrawerFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t flex flex-row gap-2 sm:gap-3">
            <DrawerClose asChild className="flex-1">
              <Button
                variant="outline"
                onClick={() => setFilterDrawerOpen(false)}
              >
                关闭
              </Button>
            </DrawerClose>
            <DrawerClose asChild className="flex-1">
              <Button onClick={() => setFilterDrawerOpen(false)}>
                应用筛选
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
