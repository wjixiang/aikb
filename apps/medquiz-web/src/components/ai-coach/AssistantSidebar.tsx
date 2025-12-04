'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import debounce from 'lodash.debounce';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageItem } from './MessageItem';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  Bot,
  User,
  Info,
  Database,
  Copy,
  Menu,
  Trash2,
  SendHorizonal,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChatRuntime } from './ChatRuntime';
import ChatInterface from './ChatInterface';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

interface AssistantSidebarProps {
  children?: React.ReactNode;
  hasSelectedQuiz: boolean;
  quizContentForInput?: string | null;
  onOpenMobileSidebar?: () => void;
  onSidebarWidthChange?: (width: number) => void;
}

const AssistantSidebarWithRef = forwardRef<
  { setIsMobileOpen: (isOpen: boolean) => void },
  AssistantSidebarProps
>(
  (
    {
      children,
      hasSelectedQuiz,
      quizContentForInput,
      onOpenMobileSidebar,
      onSidebarWidthChange,
    }: AssistantSidebarProps,
    ref,
  ) => {
    const [selectedSource] = useState('vault'); // 默认选择

    const [isMobile, setIsMobile] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Expose setIsMobileOpen through ref
    useImperativeHandle(ref, () => ({
      setIsMobileOpen,
    }));

    // Call the onOpenMobileSidebar callback when the mobile sidebar is opened
    useEffect(() => {
      if (isMobile && isMobileOpen && onOpenMobileSidebar) {
        onOpenMobileSidebar();
      }
    }, [isMobile, isMobileOpen, onOpenMobileSidebar]);

    // Debounced mobile detection
    useEffect(() => {
      const mediaQuery = window.matchMedia('(max-width: 900px)');
      const handleChange = () => {
        // Only update if the state actually changed
        if (mediaQuery.matches !== isMobile) {
          setIsMobile(mediaQuery.matches);
          setIsMobileOpen(false);
        }
      };

      // Initial check
      handleChange();

      // Add debounced listener
      const debouncedHandleChange = debounce(handleChange, 200);
      mediaQuery.addEventListener('change', debouncedHandleChange);

      return () =>
        mediaQuery.removeEventListener('change', debouncedHandleChange);
    }, [isMobile]);

    const {
      mode,
      setMode,
      messages,
      statusMessages,
      setMessages,
      currentAiMessage,
      loading,
      graphState,
      nodeStatus, // 新增节点状态
      sendMessage: handleSendMessage,
      cancelRequest,
      regenerateLastMessage,
      clearChat,
      cotMessages,
      speechQueue,
      isSpeaking,
    } = useChatRuntime();

    // No longer needed - ChatInterface handles message sending directly

    const [touchStartX, setTouchStartX] = useState(0);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Stop propagation only for the sidebar itself when open on mobile
    const stopPropagation = (e: React.MouseEvent) => {
      if (isMobile && isMobileOpen) {
        e.stopPropagation();
      }
    };

    // Handle touch start for swipe detection
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!isMobile || !isMobileOpen) return;
      setTouchStartX(e.touches[0].clientX);
    };

    // Handle touch move for swipe detection
    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isMobile || !isMobileOpen) return;
      const touchX = e.touches[0].clientX;
      const deltaX = touchX - touchStartX;

      // If swiping right (positive deltaX) more than 50px, close sidebar
      if (deltaX > 50) {
        setIsMobileOpen(false);
      }
    };

    const [isPdfFullscreen, setIsPdfFullscreen] = useState(false);

    // Close sidebar when clicking on overlay
    const handleOverlayClick = useCallback(() => {
      if (isMobile && isMobileOpen) {
        setIsMobileOpen(false);
      }
    }, [isMobile, isMobileOpen]);

    return (
      <ResizablePanelGroup
        direction="horizontal"
        className="w-full h-full flex z-100 overflow-hidden"
      >
        {/* Main content area */}
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className={`flex w-full h-full`}>
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  onFullscreenChange: setIsPdfFullscreen,
                } as Partial<unknown>);
              }
              return child;
            })}
            {isMobile && isMobileOpen && (
              <div
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
                onClick={handleOverlayClick}
              />
            )}
            {isMobile && (
              <Button
                variant="default"
                size="icon"
                className="fixed top-1/2 -translate-y-1/2 right-0 z-50 lg:hidden rounded-l-full px-3 py-2 shadow-lg"
                onClick={() => setIsMobileOpen(true)}
              >
                <Bot className="h-6 w-6" />
              </Button>
            )}
          </div>
        </ResizablePanel>

        {/* Resizer */}
        {!isMobile && <ResizableHandle withHandle />}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            maxSize={50}
            className="flex overflow-hidden relative h-full"
          >
            <Card
              ref={sidebarRef}
              className="flex overflow-hidden relative border-l border-r-0 border-t-0 border-b-0 rounded-none py-1 p-1 pt-2 pb-5 w-full h-full"
              onClick={stopPropagation}
            >
              <ChatInterface
                messages={messages}
                statusMessages={statusMessages}
                currentAiMessage={currentAiMessage}
                loading={loading}
                selectedSource={selectedSource}
                hasSelectedQuiz={hasSelectedQuiz}
                onSendMessage={handleSendMessage}
                onRegenerateLastMessage={regenerateLastMessage}
                onCancelRequest={cancelRequest}
                onClearChat={clearChat}
                quizContentForInput={quizContentForInput}
                cotMessages={cotMessages}
                showCoT={true}
                onMessagesUpdate={setMessages}
                hideHeader={true}
                hideSessionPanel={true}
              />
            </Card>
          </ResizablePanel>
        )}

        {/* Mobile sidebar */}
        {isMobile && (
          <div
            ref={sidebarRef}
            className={`fixed top-0 right-0 h-full w-[90%] transition-transform duration-300 ease-in-out z-50 flex flex-col bg-background border-l ${
              isMobileOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={stopPropagation}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            {/* Header with collapse button and chat name */}
            <div className="flex items-center justify-between border-b px-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMobileOpen(false)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <h2 className="font-medium text-sm flex-1 text-center">AI助手</h2>
              <div className="h-8 w-8" /> {/* Spacer for balance */}
            </div>

            {/* Chat content */}
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                messages={messages}
                statusMessages={statusMessages}
                currentAiMessage={currentAiMessage}
                loading={loading}
                selectedSource={selectedSource}
                hasSelectedQuiz={hasSelectedQuiz}
                onSendMessage={handleSendMessage}
                onRegenerateLastMessage={regenerateLastMessage}
                onCancelRequest={cancelRequest}
                onClearChat={clearChat}
                quizContentForInput={quizContentForInput}
                cotMessages={cotMessages}
                showCoT={true}
                hideSessionPanel={true}
              />
            </div>
          </div>
        )}
      </ResizablePanelGroup>
    );
  },
);

AssistantSidebarWithRef.displayName = 'AssistantSidebarWithRef';

export default AssistantSidebarWithRef;
