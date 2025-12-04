'use client';

import React, { useRef, useState, useEffect } from 'react';
import { QuizWithUserAnswer } from '@/types/quizData.types';
import { QuizContent } from './QuizContent';
import { Leaf } from '@/components/wiki/workspace/Leaf';
import { TabContentProps, UnifiedTab, TabType } from './UnifiedTabsTypes';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UnifiedTabContent({
  tab,
  onAnswerChange,
  onContentChange,
  onTitleChange,
  onReset,
  onQuizSelect,
  isQuizFetching,
  setQuizzes,
  isTestMode,
  quizStateUpdateTrigger,
  quizPageRef,
  onOpenDocument,
  showNotification,
  currentQuizSetId,
}: TabContentProps) {
  const quizPageRefLocal = useRef<any>(null);
  const refToUse = quizPageRef || quizPageRefLocal;

  // 渲染试卷内容
  if (tab.type === TabType.QUIZ) {
    return (
      <div className="flex w-full mx-auto h-full flex-grow min-w-0">
        <QuizContent
          quizzes={tab.quizzes || []}
          quizSetId={currentQuizSetId}
          onAnswerChange={async (
            quizId: string,
            answer: any,
            silent?: boolean,
            quizzesForQuizSet?: QuizWithUserAnswer[],
          ) => {
            if (onAnswerChange) {
              await onAnswerChange(quizId, answer, silent, quizzesForQuizSet);
            }
          }}
          onReset={() => {
            if (onReset) {
              onReset();
            }
          }}
          onQuizSelect={onQuizSelect}
          isQuizFetching={!!isQuizFetching}
          setQuizzes={setQuizzes || (() => {})}
          isTestMode={isTestMode}
          quizStateUpdateTrigger={quizStateUpdateTrigger}
          quizPageRef={refToUse}
        />
      </div>
    );
  }

  // 渲染文档内容
  if (tab.type === TabType.DOCUMENT) {
    return (
      <div className={cn('h-full flex flex-col')}>
        <div className="flex-1 overflow-y-auto">
          <Leaf
            documentPath={tab.path || ''}
            onContentChange={onContentChange}
            onTitleChange={onTitleChange}
            readOnly={false}
            onOpenDocument={onOpenDocument}
          />
        </div>
      </div>
    );
  }

  // 默认情况
  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          未知标签页类型
        </h2>
        <p className="text-muted-foreground">请选择有效的标签页类型</p>
      </div>
    </div>
  );
}
