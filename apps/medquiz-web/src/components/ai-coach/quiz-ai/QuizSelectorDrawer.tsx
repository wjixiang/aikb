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
import { QuizSelector } from "@/components/quiz/quizselector/QuizSelector";
import { useQuizAI } from "./useQuizAI";

interface QuizSelectorDrawerProps {
  selectorDrawerOpen: boolean;
  setSelectorDrawerOpen: (open: boolean) => void;
  addQuizToPage: (quizzes: any[]) => void;
}

export function QuizSelectorDrawer({
  selectorDrawerOpen,
  setSelectorDrawerOpen,
  addQuizToPage,
}: QuizSelectorDrawerProps) {
  return (
    <Drawer
      open={selectorDrawerOpen}
      onOpenChange={setSelectorDrawerOpen}
      repositionInputs={false}
    >
      <DrawerContent className="w-[90vw]">
        <div className="mx-auto w-full max-w-md flex overflow-y-auto">
          <div className="flex-1">
            <DrawerHeader>
              <DrawerTitle>章节模式</DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              <QuizSelector setQuizzes={addQuizToPage} />
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  onClick={() => setSelectorDrawerOpen(false)}
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
