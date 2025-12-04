'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Check,
  ScrollText,
  LucideLightbulb,
  Notebook,
  Languages,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import MarkdownRenderer from '../wiki/DocumentDisplay';
import { Skeleton } from '../ui/skeleton';

interface TranslationPracticeProps {
  englishText: string;
  getFullText: () => string;
  documentId?: string;
  sentenceIndex?: number;
  onFavoriteChange?: () => void;
}

export function TranslationPractice({
  englishText,
  getFullText,
  documentId,
  sentenceIndex,
  onFavoriteChange,
}: TranslationPracticeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [translation, setTranslation] = useState('');
  const [correction, setCorrection] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [full_trans, setFullTrans] = useState('');
  const [grammar, setGrammar] = useState('');
  const [score_t, setScore] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Check if sentence is favorited on mount
  useEffect(() => {
    if (documentId && sentenceIndex !== undefined) {
      checkFavoriteStatus();
    }
  }, [documentId, sentenceIndex]);

  const checkFavoriteStatus = async () => {
    if (!documentId || sentenceIndex === undefined) return;

    try {
      const response = await fetch(
        `/api/translation-practice/favorites?documentId=${documentId}&sentenceIndex=${sentenceIndex}`,
      );
      const data = await response.json();
      if (data.success) {
        setIsFavorite(data.isFavorite);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!documentId || sentenceIndex === undefined) {
      toast.error('请先保存文档才能收藏句子');
      return;
    }

    setIsTogglingFavorite(true);
    try {
      const response = await fetch('/api/translation-practice/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          sentenceIndex,
          sentence: englishText,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsFavorite(!isFavorite);
        toast.success(isFavorite ? '已取消收藏' : '已收藏');
        onFavoriteChange?.();
      } else {
        toast.error('操作失败，请重试');
      }
    } catch (error) {
      toast.error('操作失败，请重试');
      console.error('Error toggling favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleSubmit = async () => {
    if (!translation.trim()) {
      toast.error('请输入翻译内容');
      return;
    }

    // Reset all message states when submitting new translation
    setCorrection('');
    setSuggestion('');
    setFullTrans('');
    setGrammar('');
    setScore('');

    setIsLoading(true);
    try {
      const response = await fetch('/api/translation-correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original: englishText,
          translation: translation,
          fullText: getFullText(),
          documentId: documentId,
          sentenceIndex: sentenceIndex,
        }),
      });

      if (!response.ok) {
        throw new Error('批改请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6).trim();
              if (data === '[DONE]') {
                break;
              }

              try {
                const {
                  correction,
                  suggestions,
                  fullTrans,
                  score,
                  grammar_teach,
                } = JSON.parse(data);
                if (correction) setCorrection((prev) => `${prev}${correction}`);
                if (suggestions)
                  setSuggestion((prev) => `${prev}${suggestions}`);
                if (fullTrans) setFullTrans((prev) => `${prev}${fullTrans}`);
                if (score) setScore(`${score}`);
                if (grammar_teach)
                  setGrammar((prev) => `${prev}${grammar_teach}`);
              } catch (e) {
                console.error('Error parsing stream data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      toast.error('批改失败，请重试');
      console.error('Translation correction error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={
        isExpanded
          ? 'border rounded-lg p-4 mb-4 shadow-sm'
          : 'inline hover:bg-muted'
      }
    >
      <div
        className={`cursor-pointer ${isExpanded ? 'mb-2' : 'inline'}`}
        onClick={toggleExpand}
      >
        {!isExpanded && (
          <span className="text-sm text-muted-foreground mr-2">翻译练习:</span>
        )}
        {isExpanded && (
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-muted-foreground">翻译练习</p>
            {documentId && sentenceIndex !== undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite();
                }}
                disabled={isTogglingFavorite}
                className="h-8 w-8 p-0"
              >
                <Heart
                  className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                />
              </Button>
            )}
          </div>
        )}
        <p
          className={`font-medium ${isExpanded ? 'text-base' : 'inline'}`}
          onClick={(e) => isExpanded && e.stopPropagation()}
        >
          {englishText}
        </p>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">你的翻译</label>
            <Textarea
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="请输入你的翻译（尽量保持原意）..."
              className="min-h-[120px] text-base"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  批改中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  提交批改
                </>
              )}
            </Button>

            {documentId && sentenceIndex !== undefined && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFavorite}
                disabled={isTogglingFavorite}
              >
                <Heart
                  className={`mr-2 h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                />
                {isFavorite ? '已收藏' : '收藏'}
              </Button>
            )}
          </div>

          {!correction ? (
            <Skeleton />
          ) : (
            <div className="p-2 rounded-lg space-y-4 gap-2">
              <div className="bg-muted p-2 rounded-md">
                <h4 className="font-medium mb-2 bg-muted flex text-primary">
                  {' '}
                  <ScrollText /> 批改结果 {score_t}/10分
                </h4>
                <MarkdownRenderer content={correction} />
              </div>
              {suggestion.length > 1 && (
                <div className="bg-muted p-2 rounded-md">
                  <h4 className="font-medium mb-2 flex text-primary">
                    {' '}
                    <LucideLightbulb /> 修改建议
                  </h4>
                  <MarkdownRenderer content={suggestion} />
                </div>
              )}

              {grammar.length > 1 && (
                <div className="bg-muted p-2 rounded-md">
                  <h4 className="font-medium mb-2 flex text-primary">
                    {' '}
                    <Notebook /> 语法详解
                  </h4>
                  <MarkdownRenderer content={grammar} />
                </div>
              )}

              {full_trans.length > 1 && (
                <div className="bg-muted p-2 rounded-md">
                  <h4 className="font-medium mb-2 flex text-primary">
                    {' '}
                    <Languages /> 完整翻译
                  </h4>
                  <MarkdownRenderer content={full_trans} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
