"use client";

import React, {
  useState,
  useRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import { QuizWithUserAnswer } from "@/types/quizData.types";
import { QuizContent } from "@/components/ai-coach/QuizContent";
import { QuizPageImperativeHandle } from "@/components/quiz/QuizPage";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Tab {
  id: string;
  title: string;
  quizzes: QuizWithUserAnswer[];
}

interface QuizTabsProps {
  onAnswerChange: (
    quizId: string,
    answer: any,
    silent?: boolean,
    quizzesForQuizSet?: QuizWithUserAnswer[],
  ) => Promise<void>;
  showNotification: (message: string, type: "success" | "error") => void;
  currentQuizSetId?: string;
  loadingOperation: string | null;
  setSelectedQuizIndex: (index: number | null) => void;
  isTestMode?: boolean;
  quizStateUpdateTrigger?: number;
  handleSubmit?: (quizzes: QuizWithUserAnswer[], title?: string) => Promise<void>;
}

export interface QuizTabsRef {
  addQuizToPage: (quizzesToAdd: QuizWithUserAnswer[]) => void;
  addTab: () => void;
  createTabWithQuizzes: (quizzes: QuizWithUserAnswer[], title?: string, createNewSet?: boolean) => void;
  getCurrentTabQuizzes: () => QuizWithUserAnswer[];
  getCurrentTabId: () => string | null;
  getCurrentQuiz: () => QuizWithUserAnswer | null;
}

export const QuizTabs = React.forwardRef<QuizTabsRef, QuizTabsProps>(
  (
    {
      onAnswerChange,
      showNotification,
      currentQuizSetId,
      loadingOperation,
      setSelectedQuizIndex,
      isTestMode,
      quizStateUpdateTrigger,
      handleSubmit,
    }: QuizTabsProps,
    ref,
  ) => {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [showLeftScroll, setShowLeftScroll] = useState(false);
    const [showRightScroll, setShowRightScroll] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const quizContentRefs = useRef<
      Record<string, React.RefObject<QuizPageImperativeHandle | null>>
    >({});

    // Calculate visible tabs based on container width
    const { visibleTabs, hiddenTabsCount, maxVisibleTabs } = useMemo(() => {
      if (!containerRef.current || tabs.length <= 1) {
        return { visibleTabs: tabs, hiddenTabsCount: 0, maxVisibleTabs: tabs.length };
      }

      const containerWidth = containerRef.current.offsetWidth;
      const addButtonWidth = 32; // Plus button width
      const availableWidth = containerWidth - addButtonWidth;
      
      // Estimate max tabs that can fit (each tab needs ~100px minimum)
      const estimatedMaxTabs = Math.max(1, Math.floor(availableWidth / 100));
      const maxTabs = Math.min(tabs.length, estimatedMaxTabs);
      
      return {
        visibleTabs: tabs.slice(0, maxTabs),
        hiddenTabsCount: tabs.length - maxTabs,
        maxVisibleTabs: maxTabs
      };
    }, [tabs]);

    // Function to truncate title to 2 characters
    const truncateTitle = useCallback((title: string): string => {
      if (title.length <= 2) return title;
      return title.substring(0, 2);
    }, []);

    // Handle dropdown click
    const handleDropdownClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const dropdownWidth = 200; // Approximate dropdown width
        
        // Calculate left position, ensuring dropdown doesn't exceed right boundary
        let leftPosition = rect.left;
        if (leftPosition + dropdownWidth > viewportWidth) {
          leftPosition = viewportWidth - dropdownWidth - 10; // 10px margin from right edge
        }
        
        setDropdownPosition({
          top: rect.bottom + 4,
          left: leftPosition
        });
      }
      setShowDropdown(!showDropdown);
    }, [showDropdown]);

    // Handle tab selection from dropdown
    const handleTabSelect = useCallback((tabId: string) => {
      setActiveTabId(tabId);
      setShowDropdown(false);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    // Check scroll indicators
    const checkScrollIndicators = useCallback(() => {
      if (scrollAreaRef.current) {
        const scrollArea = scrollAreaRef.current;
        const { scrollLeft, scrollWidth, clientWidth } = scrollArea;
        setShowLeftScroll(scrollLeft > 0);
        setShowRightScroll(scrollLeft < scrollWidth - clientWidth);
      }
    }, []);

    // Add scroll event listener
    useEffect(() => {
      const scrollArea = scrollAreaRef.current;
      if (scrollArea) {
        scrollArea.addEventListener("scroll", checkScrollIndicators);
        // Initial check
        checkScrollIndicators();
        return () =>
          scrollArea.removeEventListener("scroll", checkScrollIndicators);
      }
    }, [checkScrollIndicators]);

    // Recalculate visible tabs when container resizes
    useEffect(() => {
      const handleResize = () => {
        // Force re-calculation by updating state
        setTabs(prev => [...prev]);
      };
      
      const resizeObserver = new ResizeObserver(handleResize);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
      
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }, []);

    // Scroll functions
    const scrollLeft = () => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollBy({ left: -200, behavior: "smooth" });
      }
    };

    const scrollRight = () => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollBy({ left: 200, behavior: "smooth" });
      }
    };

    // Tab management functions
    const addTab = () => {
      const newTabId = Date.now().toString();
      const newTab = {
        id: newTabId,
        title: currentQuizSetId || `试卷 ${tabs.length + 1}`,
        quizzes: [],
      };
      // Create a ref for the new tab's QuizContent
      quizContentRefs.current[newTabId] =
        React.createRef<QuizPageImperativeHandle>();
      setTabs([...tabs, newTab]);
      setActiveTabId(newTabId);
    };

    const removeTab = (tabId: string) => {
      if (tabs.length <= 1) return;
      const newTabs = tabs.filter((tab) => tab.id !== tabId);
      setTabs(newTabs);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0].id);
      }
    };

    const updateTabQuizzes = (tabId: string, quizzes: QuizWithUserAnswer[]) => {
      setTabs(
        tabs.map((tab) => (tab.id === tabId ? { ...tab, quizzes } : tab)),
      );
    };

    // Update tab title
    const updateTabTitle = (tabId: string, title: string) => {
      setTabs(tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)));
    };

    const getActiveTab = () => {
      if (!activeTabId || tabs.length === 0) return null;
      return tabs.find((tab) => tab.id === activeTabId) || null;
    };

    // Add quizzes to a new tab and create corresponding quiz set
    const addQuizToPage = (quizzesToAdd: QuizWithUserAnswer[]) => {
      // Always create a new tab with the quizzes
      createTabWithQuizzes(quizzesToAdd);
    };

    // Create a new tab with specific quizzes
    const createTabWithQuizzes = (
      quizzes: QuizWithUserAnswer[],
      title?: string,
      createNewSet: boolean = true,
    ) => {
      const newTabId = Date.now().toString();
      const newTab = {
        id: newTabId,
        title: title || `新试卷 ${tabs.length + 1}`,
        quizzes: quizzes,
      };
      // Create a ref for the new tab's QuizContent
      quizContentRefs.current[newTabId] =
        React.createRef<QuizPageImperativeHandle>();
      setTabs([...tabs, newTab]);
      setActiveTabId(newTabId);
      
      // Only create new quiz set if explicitly requested
      if (quizzes.length > 0 && handleSubmit && createNewSet) {
        handleSubmit(quizzes, title || `新试卷 ${tabs.length + 1}`);
      }
    };

    // Reset quizzes in the active tab
    const resetQuizzes = () => {
      const activeTab = getActiveTab();
      if (!activeTab) return;
      updateTabQuizzes(activeTab.id, []);
      showNotification("已重置当前试卷", "success");
    };

    // Expose functions via ref
    React.useImperativeHandle(ref, () => ({
      addQuizToPage,
      addTab,
      createTabWithQuizzes: (quizzes, title, createNewSet = true) => {
        createTabWithQuizzes(quizzes, title, createNewSet);
      },
      getCurrentTabQuizzes: () => getActiveTab()?.quizzes || [],
      getCurrentTabId: () => activeTabId,
      getCurrentQuiz: () => {
        if (!activeTabId) return null;
        const quizContentRef = quizContentRefs.current[activeTabId];
        if (!quizContentRef || !quizContentRef.current) return null;
        const currentQuizIndex = quizContentRef.current.getCurrentQuizIndex();
        const activeTab = getActiveTab();
        if (
          !activeTab ||
          currentQuizIndex < 0 ||
          currentQuizIndex >= activeTab.quizzes.length
        )
          return null;
        return activeTab.quizzes[currentQuizIndex];
      },
    }));

    return (
      <Tabs
        value={activeTabId || ""}
        onValueChange={(value) => setActiveTabId(value || null)}
        className="w-full h-full flex flex-col"
      >
        <div className="flex items-end flex-shrink-0 relative" ref={containerRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={addTab}
            className="h-8 w-8 border-b rounded-none flex-shrink-0 z-10"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0 relative">
            <div
              ref={scrollAreaRef}
              className="w-full whitespace-nowrap rounded-none"
            >
              <TabsList className="w-full p-0 bg-transparent justify-start border-b rounded-none min-w-0 flex">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={`border-b data-[state=active]:border data-[state=active]:border-b-transparent rounded-none bg-background h-full data-[state=active]:shadow-none -mb-[2px] rounded-t max-w-[200px] min-w-[80px] truncate justify-between items-center px-2 ${
                      !visibleTabs.some(visibleTab => visibleTab.id === tab.id) ? 'hidden' : ''
                    }`}
                  >
                    <span className="truncate flex-1 text-ellipsis overflow-hidden whitespace-nowrap">
                      {tab.title}
                    </span>
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTab(tab.id);
                        }}
                        className="ml-1 hover:bg-muted rounded-sm p-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    )}
                  </TabsTrigger>
                ))}
                
                {/* Overflow indicator */}
                {hiddenTabsCount > 0 && (
                  <div
                    ref={dropdownRef}
                    className="border-b border-muted rounded-t max-w-[200px] min-w-[80px] h-full flex items-center justify-center px-2 bg-muted/50 text-muted-foreground text-sm cursor-pointer hover:bg-muted transition-colors relative"
                    onClick={handleDropdownClick}
                  >
                    <span className="flex items-center">
                      +{hiddenTabsCount}
                      <ChevronDownIcon className="h-3 w-3 ml-1" />
                    </span>
                  </div>
                )}

                {/* Dropdown menu for hidden tabs */}
                {showDropdown && hiddenTabsCount > 0 && (
                  <div
                    className="absolute z-30 bg-background border border-border rounded-md shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tabs.slice(maxVisibleTabs).map((tab) => (
                      <div
                        key={tab.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-muted transition-colors flex items-center ${
                          activeTabId === tab.id ? 'bg-muted border-l-2 border-primary' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTabSelect(tab.id);
                        }}
                      >
                        <span className="truncate flex-1">
                          {tab.title}
                        </span>
                        {activeTabId === tab.id && (
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsList>
            </div>
          </div>

        </div>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="mt-0 w-full flex-grow overflow-hidden"
          >
            <QuizContent
              quizzes={tab.quizzes}
              quizSetId={currentQuizSetId}
              onAnswerChange={async (quizId, answer) => {
                await onAnswerChange(quizId, answer, false, tab.quizzes);
                // Update the local quiz state with the submitted answer
                updateTabQuizzes(
                  tab.id,
                  tab.quizzes.map((quiz) =>
                    quiz._id === quizId
                      ? { ...quiz, userAnswer: answer }
                      : quiz,
                  ),
                );
              }}
              onReset={() => {
                updateTabQuizzes(tab.id, []);
                showNotification("已重置当前试卷", "success");
              }}
              onQuizSelect={setSelectedQuizIndex}
              isQuizFetching={!!loadingOperation}
              setQuizzes={(quizzes) => {
                if (typeof quizzes === "function") {
                  const newQuizzes = quizzes(tab.quizzes);
                  updateTabQuizzes(tab.id, newQuizzes);
                } else {
                  updateTabQuizzes(tab.id, quizzes);
                }
              }}
              isTestMode={isTestMode}
              quizStateUpdateTrigger={quizStateUpdateTrigger}
              quizPageRef={quizContentRefs.current[tab.id]}
            />
          </TabsContent>
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>点击 + 按钮创建新试卷</p>
          </div>
        )}
      </Tabs>
    );
  },
);

QuizTabs.displayName = "QuizTabs";
