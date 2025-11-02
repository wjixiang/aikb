"use client";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useState,
  ReactNode,
  useRef,
  Suspense,
  useEffect,
  useCallback,
} from "react";
import SearchPage from "./Search";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  BookOpen,
  X,
  MessageCircle,
  Bot,
  Brain,
} from "lucide-react";

import { ChevronDown } from "lucide-react";
import { UserSubscription } from "@/types/anki.types";
import FSRSPage from "@/components/fsrs/FSRSPage";
import { QuizSelectPortal } from "@/components/quiz/quizselector/QuizSelectPortal";

interface WikiLayoutProps {
  children: ReactNode;
}

export default function WikiLayout({ children }: WikiLayoutProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320);
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);

  const leftDragHandleRef = useRef<HTMLDivElement>(null);
  const rightDragHandleRef = useRef<HTMLDivElement>(null);

  const leftSidebarWidthRef = useRef(leftSidebarWidth);
  const rightSidebarWidthRef = useRef(rightSidebarWidth);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const isDraggingLeftRef = useRef(false);
  const isDraggingRightRef = useRef(false);

  useEffect(() => {
    leftSidebarWidthRef.current = leftSidebarWidth;
    rightSidebarWidthRef.current = rightSidebarWidth;
  }, [leftSidebarWidth, rightSidebarWidth]);

  const handleLeftDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingLeftRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const newWidth = Math.max(
      200,
      Math.min(400, startWidthRef.current + deltaX),
    );
    setLeftSidebarWidth(newWidth);
  }, []);

  const handleRightDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingRightRef.current) return;
    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.max(
      200,
      Math.min(400, startWidthRef.current + deltaX),
    );
    setRightSidebarWidth(newWidth);
  }, []);

  const handleLeftDragEnd = useCallback(() => {
    isDraggingLeftRef.current = false;
    setIsDraggingLeft(false);
    document.removeEventListener("mousemove", handleLeftDrag);
    document.removeEventListener("mouseup", handleLeftDragEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [handleLeftDrag]);

  const handleRightDragEnd = useCallback(() => {
    isDraggingRightRef.current = false;
    setIsDraggingRight(false);
    document.removeEventListener("mousemove", handleRightDrag);
    document.removeEventListener("mouseup", handleRightDragEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [handleRightDrag]);

  const handleLeftDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingLeftRef.current = true;
      setIsDraggingLeft(true);
      startXRef.current = e.clientX;
      startWidthRef.current = leftSidebarWidthRef.current;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", handleLeftDrag);
      document.addEventListener("mouseup", handleLeftDragEnd);
    },
    [handleLeftDrag, handleLeftDragEnd],
  );

  const handleRightDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRightRef.current = true;
      setIsDraggingRight(true);
      startXRef.current = e.clientX;
      startWidthRef.current = rightSidebarWidthRef.current;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("mousemove", handleRightDrag);
      document.addEventListener("mouseup", handleRightDragEnd);
    },
    [handleRightDrag, handleRightDragEnd],
  );
  const [mobileLeftSidebarOpen, setMobileLeftSidebarOpen] =
    useState<boolean>(false);
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] =
    useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatMinimized, setChatMinimized] = useState<boolean>(false);
  const [chatFullscreen, setChatFullscreen] = useState<boolean>(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatHeaderRef = useRef<HTMLDivElement>(null);

  const chatOpenRef = useRef(chatOpen);
  const chatMinimizedRef = useRef(chatMinimized);
  const chatFullscreenRef = useRef(chatFullscreen);

  const [reviewOpen, setReviewOpen] = useState<boolean>(false);
  const [dueCardsCount, setDueCardsCount] = useState<number>(0);
  const [userSubscriptions, setUserSubscriptions] = useState<
    UserSubscription[]
  >([]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    chatMinimizedRef.current = chatMinimized;
    chatFullscreenRef.current = chatFullscreen;
  }, [chatOpen, chatMinimized, chatFullscreen]);

  useEffect(() => {
    const fetchCardCollectionStatus = async () => {
      const response = await fetch("/api/fsrs/collections/subscriptions");
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        setUserSubscriptions(data);
        // Calculate total due count from all subscriptions
        const totalDue = data.reduce(
          (sum: number, sub: UserSubscription) => sum + (sub.dueCount || 0),
          0,
        );
        setDueCardsCount(totalDue);
      }
    };
    fetchCardCollectionStatus();

    const intervalId = setInterval(fetchCardCollectionStatus, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!chatOpenRef.current || chatMinimizedRef.current) return;
      if (chatFullscreenRef.current) return;

      if (chatRef.current && chatRef.current.contains(event.target as Node)) {
        return;
      }

      if (chatFullscreen) {
        return;
      }

      const target = event.target as HTMLElement;
      const isPopupElement = target.closest(
        '[role="listbox"], [role="menu"], [role="dialog"], .popover, .dropdown',
      );
      if (isPopupElement) return;

      setChatMinimized(true);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleChatFullscreen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChatFullscreen((prev) => !prev);
    setChatOpen(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/wiki/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const toggleChat = () => {
    if (!chatOpen) {
      setChatOpen(true);
      setChatMinimized(false);
    } else {
      setChatMinimized(!chatMinimized);
    }
  };

  const closeChat = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setChatOpen(false);
  };

  const handleChatHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const minimizeChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChatMinimized(true);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="md:hidden text-foreground p-4 flex justify-between items-center border-b-2">
        <Button
          variant="ghost"
          className="text-background bg-primary"
          onClick={() => setMobileLeftSidebarOpen(true)}
        >
          <Search size={20} />
        </Button>
        <Button
          variant="ghost"
          className="text-background bg-primary"
          onClick={() => setMobileRightSidebarOpen(true)}
        >
          <BookOpen size={20} />
        </Button>
      </header>

      <header className="hidden md:flex text-foreground p-2 border-b-2 w-full">
        <div className="flex justify-start w-full">
          <Button
            variant="ghost"
            className="text-foreground mr-2"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          >
            <Search size={20} />
          </Button>
        </div>
        <div className="flex justify-end w-full">
          <Button
            variant="ghost"
            className="text-foreground hover:bg-muted"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          >
            <BookOpen size={20} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 md:hidden ${
            mobileLeftSidebarOpen
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileLeftSidebarOpen(false)}
        />

        <aside
          className={`fixed top-0 left-0 h-full w-80 border-2 bg-background z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
            mobileLeftSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex justify-end p-4 bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileLeftSidebarOpen(false)}
              className="h-8 w-8 p-0 bg-mute"
            >
              <X size={20} />
            </Button>
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
            <Sidebar />
          </div>
        </aside>

        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 md:hidden ${
            mobileRightSidebarOpen
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileRightSidebarOpen(false)}
        />

        <aside
          className={`fixed top-0 right-0 h-full w-full bg-background z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
            mobileRightSidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex justify-start p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileRightSidebarOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X size={20} />
            </Button>
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
            <QuizSelectPortal />
          </div>
        </aside>

        <aside
          className={`hidden md:block border-r bg-background transition-all duration-300 ease-in-out ${
            leftSidebarOpen ? "" : "w-12"
          }`}
          style={{
            width: leftSidebarOpen ? `${leftSidebarWidth}px` : undefined,
          }}
        >
          <div
            className={`flex ${leftSidebarOpen ? "justify-end" : "justify-center"} p-1`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="h-8 w-8 p-0"
            >
              {leftSidebarOpen ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </Button>
          </div>

          <div
            className={`transition-all duration-300 ${
              leftSidebarOpen
                ? "opacity-100 max-h-full overflow-y-auto"
                : "opacity-0 max-h-0 overflow-hidden"
            }`}
          >
            <Sidebar />
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-1 overflow-auto relative">
          {children}
        </main>

        {(isDraggingLeft || isDraggingRight) && (
          <div
            className="fixed inset-0 z-40 cursor-col-resize"
            style={{ userSelect: "none" }}
          />
        )}

        {leftSidebarOpen && (
          <div
            ref={leftDragHandleRef}
            className={`fixed top-0 h-full w-3 cursor-col-resize z-40 ${
              isDraggingLeft
                ? "bg-blue-500"
                : "hover:bg-blue-300 hover:opacity-50"
            }`}
            onMouseDown={handleLeftDragStart}
            style={{
              left: `${leftSidebarWidth - 1}px`,
              transform: "translateX(-50%)",
            }}
          />
        )}

        {rightSidebarOpen && (
          <div
            ref={rightDragHandleRef}
            className={`fixed top-0 h-full w-3 cursor-col-resize z-40 ${
              isDraggingRight
                ? "bg-blue-500"
                : "hover:bg-blue-300 hover:opacity-50"
            }`}
            onMouseDown={handleRightDragStart}
            style={{
              right: `${rightSidebarWidth - 1}px`,
              transform: "translateX(50%)",
            }}
          />
        )}

        <aside
          className={`hidden md:block border-l bg-background transition-all duration-300 ease-in-out ${
            rightSidebarOpen ? "" : "w-12"
          }`}
          style={{
            width: rightSidebarOpen ? `${rightSidebarWidth}px` : undefined,
          }}
        >
          <div
            className={`flex ${rightSidebarOpen ? "justify-start" : "justify-center"} p-1`}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="h-8 w-8 p-0"
            >
              {rightSidebarOpen ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </Button>
          </div>

          <div
            className={`p-3 transition-all duration-300 ${
              rightSidebarOpen
                ? "opacity-100 max-h-full overflow-y-auto"
                : "opacity-0 max-h-0 overflow-hidden"
            }`}
          >
            <QuizSelectPortal />
          </div>
        </aside>
      </div>

      <div
        id="fsrs"
        // className={`bottom-0 left-0 w-full bg-white transition-transform duration-300 ease-in-out ${
        //   reviewOpen ? 'h-0' : 'h-10'
        // }`}
        className={`fixed bottom-0 left-0 w-full bg-white transition-transform duration-300 ease-in-out ${
          reviewOpen ? "transform translate-y-0" : "transform translate-y-full"
        }`}
      >
        <FSRSPage />
      </div>

      <div className="fixed bottom-6 right-24 z-[1000]">
        <button
          onClick={() => setReviewOpen(!reviewOpen)}
          className="bg-amber-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
          title={`${dueCardsCount}张卡片待复习`}
        >
          <div className="relative">
            <Brain size={24} />
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {dueCardsCount}
            </div>
          </div>
        </button>
      </div>

      <div className="fixed bottom-6 right-6 z-[1000]">
        <div
          ref={chatRef}
          className={`absolute ${
            chatFullscreen
              ? "-bottom-6 -right-6 w-screen h-screen rounded-none"
              : "bottom-16 right-0 w-[350px] h-[550px] rounded-lg"
          } overflow-hidden bg-white border border-border z-[1000] transition-all duration-300 ease-in-out ${
            chatOpen
              ? chatMinimized
                ? "opacity-0 pointer-events-none transform translate-y-20 scale-90"
                : "opacity-100 transform translate-y-0 scale-100"
              : "opacity-0 pointer-events-none transform translate-y-20 scale-90"
          }`}
          style={{
            boxShadow: chatFullscreen
              ? "none"
              : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            ref={chatHeaderRef}
            className="bg-primary text-primary-foreground p-3 flex justify-between items-center"
            onClick={handleChatHeaderClick}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center">
              <Bot size={20} className="mr-2" />
              <span className="font-medium">AI 检索</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary/80"
                onClick={toggleChatFullscreen}
                data-action="fullscreen"
              >
                {chatFullscreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary/80"
                onClick={minimizeChat}
              >
                <ChevronDown size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary/80"
                onClick={closeChat}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
          <div
            className={`${chatFullscreen ? "h-[calc(100%-48px)]" : "h-[calc(100%-48px)]"} bg-white`}
          >
            {/* <AssistantSidebar /> */}
          </div>
        </div>

        <button
          onClick={toggleChat}
          className={`bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-[1000]`}
        >
          {chatOpen && chatMinimized ? (
            <MessageCircle size={24} />
          ) : (
            <Bot size={24} />
          )}
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <Suspense>
      <div className="bg-background text-foreground dark:text-white p-1 h-full">
        <h2 className="text-xl font-bold mb-4">关键词检索</h2>
        <SearchPage />
      </div>
    </Suspense>
  );
}
