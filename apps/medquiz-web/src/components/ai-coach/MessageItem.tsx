'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckIcon, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import MarkdownRenderer from '../wiki/DocumentDisplay';
import { useSession } from 'next-auth/react';
import { ChatMessage, Reference } from '@/lib/agents/agent.types';
import { MessageSources } from './MessageSources';

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  loading?: boolean;
  cotContent?: string;
  showCoT?: boolean;
  isRenderRef?: boolean;
}

export function MessageItem({
  message,
  onRegenerate,
  loading,
  cotContent,
  showCoT = true,
  isRenderRef = true,
}: MessageItemProps) {
  const { data: session } = useSession();
  const [showSources, setShowSources] = useState(false); // Local state for sources
  const [showCoTDetails, setShowCoTDetails] = useState(true);
  const isAi = message.sender === 'ai';
  const isUser = message.sender === 'user';
  const timestampKey = message.timestamp.toISOString();

  const toggleSources = () => {
    setShowSources((prev) => !prev);
  };

  const toggleCoT = () => {
    setShowCoTDetails((prev) => !prev);
  };

  const processTextForCopy = (text: string): string => {
    // Remove [ref:<index>] annotations from the text
    return text.replace(/\[ref:\d+\]/g, '').trim();
  };

  const handleCopy = async () => {
    try {
      const rawText = Array.isArray(message.content)
        ? message.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join(' ')
        : typeof message.content === 'string'
          ? message.content
          : '';
      const textContent = processTextForCopy(rawText);
      await navigator.clipboard.writeText(textContent);
      toast.success('复制成功', {
        style: {
          backgroundColor: '#4caf50',
          color: 'white',
        },
        description: '消息内容已复制到剪贴板',
        duration: 2000,
      });
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        const rawText = Array.isArray(message.content)
          ? message.content
              .filter((part: any) => part.type === 'text')
              .map((part: any) => part.text)
              .join(' ')
          : typeof message.content === 'string'
            ? message.content
            : '';
        const textContent = processTextForCopy(rawText);
        textarea.value = textContent;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (success) {
          toast.success('复制成功', {
            style: {
              backgroundColor: '#4caf50',
              color: 'white',
            },
            description: '消息内容已复制到剪贴板',
            duration: 2000,
          });
        } else {
          throw new Error('execCommand failed');
        }
      } catch (fallbackErr) {
        toast.error('复制失败', {
          style: {
            backgroundColor: '#f44336',
            color: 'white',
          },
          description: '无法访问剪贴板',
          duration: 2000,
        });
      }
    }
  };

  if (message.messageType === 'status') {
    return (
      <div className="my-2">
        <div className="flex items-center text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
          <CheckIcon className="w-3 h-3 mr-1" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${isUser ? 'mb-4' : 'mb-6'}`}>
      <div className="w-full">
        <div
          className={`${isUser ? 'bg-muted/50' : ''} ${message.isErrorMessage ? 'bg-destructive/10' : ''} rounded-sm`}
        >
          {/* CoT Display - only for AI messages and when showCoT is true */}
          {isAi && (message.CoT || cotContent) && (
            <div className="border border-border/50">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30"
                onClick={toggleCoT}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  思考过程
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showCoTDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              {showCoTDetails && (
                <div className="px-3 pb-2">
                  <div className="text-xs text-muted p-2 rounded">
                    <MarkdownRenderer
                      content={message.CoT || cotContent || ''}
                      references={[]}
                      basePath="/wiki"
                      fontColor="hsl(var(--muted-foreground))"
                      isRenderRef={isRenderRef}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="markdown-content px-3 py-2">
            <MarkdownRenderer
              content={message.content}
              references={message.sources}
              basePath="/wiki"
              isRenderRef={isRenderRef}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
              {format(message.timestamp, 'HH:mm')}
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleCopy}
            >
              <Copy size={12} />
            </Button>

            {isAi && onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onRegenerate}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </Button>
            )}

            {isAi && message.sources && message.sources.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={toggleSources}
              >
                <Info size={12} />
                <span className="ml-1">{message.sources.length}</span>
              </Button>
            )}
          </div>
        </div>

        {isAi &&
          message.messageType === 'content' &&
          message.sources &&
          showSources && (
            <div className="mt-2 px-3">
              <MessageSources
                sources={message.sources}
                content={
                  typeof message.content === 'string' ? message.content : ''
                }
              />
            </div>
          )}
      </div>
    </div>
  );
}
