"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
  MouseEvent,
} from "react";
import { useSession } from "next-auth/react";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { OptionType } from "../quiz/SelectBox";
import { cn } from "@/lib/utils";
import { MultiSelectCombobox } from "./MultiSelectCombobox";
import ReviewFilter from "./ReviewFilter";
import { quiz, QuizWithUserAnswer } from "../../types/quizData.types";
import { quizSelector, ReviewMode } from "@/types/quizSelector.types";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizWithUserAnswer[],
): QuizWithUserAnswer[] => {
  const typeOrder: Record<string, number> = {
    A1: 0,
    A2: 0,
    A3: 1,
    B: 2,
    X: 3,
  };

  return [...quizzes].sort((a, b) => {
    const orderA = typeOrder[a.type] ?? 999;
    const orderB = typeOrder[b.type] ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return 0; // Maintain original order for same types
  });
};

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagPresetManager } from "./TagPresetManager";
import { PublicTagManager } from "./PublicTagManager";
import { TagPreset } from "@/types/quizSelector.types";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const FilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  /* background: #ffffff;   */
  border-radius: 12px;
  /* box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);   */
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const FilterLabel = styled.label`
  min-width: 80px;
  font-size: 14px;
  font-weight: 500;
`;

const StyledInput = styled.input`
  width: 120px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;

  &:focus {
    border-color: #4a90e2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  height: 40px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #357abd;
  }

  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
`;

type Props = {
  setQuizzes: (quizzes: quiz[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  isLoading: boolean;
  createNewTab?: (quizzes: quiz[], title?: string) => void;
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const QuizFilterPanel = ({
  setQuizzes,
  setIsLoading,
  isLoading,
  createNewTab,
}: Props) => {
  const [cls, setCls] = useState<string[]>([]);
  const [quizNum, setQuizNum] = useState(10);
  const debouncedQuizNum = useDebounce(quizNum, 500);
  const [mode, setMode] = useState<string[]>([]);
  const [unit, setUnit] = useState<string[]>([]);
  const [source, setSource] = useState<string[]>([]);
  const [extractedYear, setExtractedYear] = useState<number[]>([]);
  const [onlyHasDone, setOnlyHasDone] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("normal");
  const [scoringWeights, setScoringWeights] = useState({
    errorRate: 0.6,
    consecutiveWrong: 0.2,
    recency: 0.2,
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  // 新增：标签相关状态
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"AND" | "OR">("AND");
  const [tagTypeFilter, setTagTypeFilter] = useState<"all" | "private" | "public">("all");
  // 新增：排除标签相关状态
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [excludeTagFilterMode, setExcludeTagFilterMode] = useState<"AND" | "OR">("AND");
  const [excludeTagTypeFilter, setExcludeTagTypeFilter] = useState<"all" | "private" | "public">("all");
  // 新增：预设管理相关状态
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<TagPreset | null>(null);
  const [activeTagTab, setActiveTagTab] = useState("presets");

  const debouncedScoringWeights = useDebounce(scoringWeights, 500);

  const [clsOptions, setClsOptions] = useState<OptionType[]>([]);

  // 阻止事件冒泡的通用处理函数
  const stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    const updateOptions = async () => {
      console.log("fetch subject");
      const newOptions = await fetchOptions();
      console.log("subject fetched");
      setClsOptions(newOptions);
    };

    updateOptions();
    loadDefaultPreset();
  }, []);

  // 加载默认预设
  const loadDefaultPreset = async () => {
    try {
      const response = await fetch("/api/user/tags/presets");
      if (response.ok) {
        const presets = await response.json();
        const defaultPreset = presets.find((p: TagPreset) => p.isDefault);
        if (defaultPreset) {
          handlePresetSelect(defaultPreset);
        }
      }
    } catch (error) {
      console.error("Error loading default preset:", error);
    }
  };

  const fetchOptions = async () => {
    try {
      // setIsLoadingOptions(true);
      const response = await fetch("/api/obcors/subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selector),
      });
      const classList: string[] = await response.json();

      return classList.map((value) => ({
        value: value,
        label: value,
      }));
    } catch (error) {
      console.error("Error fetching options:", error);
      return [];
    } finally {
      // setIsLoadingOptions(false);
    }
  };

  // 使用 useMemo 创建 selector
  const { data: session } = useSession();
  const selector = useMemo(
    () => ({
      cls,
      mode,
      quizNum: debouncedQuizNum,
      unit,
      source,
      extractedYear,
      onlyHasDone,
      reviewMode,
      scoringWeights:
        reviewMode === "review" ? debouncedScoringWeights : undefined,
      startDate,
      endDate,
      email: session?.user?.email || "",
      tags: selectedTags,
      tagFilterMode,
      tagTypeFilter,
      excludeTags,
      excludeTagFilterMode,
      excludeTagTypeFilter,
    }),
    [
      cls,
      mode,
      debouncedQuizNum,
      unit,
      source,
      extractedYear,
      onlyHasDone,
      reviewMode,
      debouncedScoringWeights,
      startDate,
      endDate,
      session,
      selectedTags,
      tagFilterMode,
      tagTypeFilter,
      excludeTags,
      excludeTagFilterMode,
      excludeTagTypeFilter,
    ],
  );

  const createPage = async (selector: quizSelector) => {
    try {
      const response = await fetch("/api/obcors/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selector }),
      });
      const quizdata = await response.json();
      return sortQuizzesByType(quizdata);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      // 可以添加错误提示
      return [];
    }
  };

  const submitSelector = async (e: MouseEvent) => {
    // 阻止事件冒泡
    // e.stopPropagation();

    setIsLoading(true);
    try {
      const quizdata = await createPage(selector);
      if (createNewTab) {
        // Generate a title based on the selected criteria
        const titleParts = [];
        if (cls.length > 0) titleParts.push(cls.join(", "));
        if (unit.length > 0) titleParts.push(unit.join(", "));
        if (mode.length > 0) titleParts.push(mode.join(", "));
        if (source.length > 0) titleParts.push(source.join(", "));

        const title =
          titleParts.length > 0
            ? `${titleParts.join(" - ")} (${quizNum}题)`
            : `新试卷 (${quizNum}题)`;

        createNewTab(quizdata, title);
      } else {
        setQuizzes(quizdata);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizNumChange = (value: number[]) => {
    setQuizNum(value[0]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // 阻止可能的合成事件冒泡
    e.stopPropagation();
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 300) {
      setQuizNum(value);
    } else if (e.target.value === "") {
      setQuizNum(0); // Or some other default/empty state
    }
  };

  // 处理预设应用
  const handlePresetSelect = (preset: TagPreset) => {
    setSelectedTags(preset.includeTags);
    setExcludeTags(preset.excludeTags);
    setTagFilterMode(preset.includeTagFilterMode);
    setExcludeTagFilterMode(preset.excludeTagFilterMode);
    setCurrentPreset(preset);
    setShowPresetManager(false);
  };

  // 清除当前预设
  const clearCurrentPreset = () => {
    setCurrentPreset(null);
  };

  return (
    <>
      <FilterContainer onClick={stopPropagation}>
        <FilterRow onClick={stopPropagation}>
          <FilterLabel>科目</FilterLabel>
          <div onClick={stopPropagation}>
            <MultiSelectCombobox
              boxName="科目"
              cluster={cls}
              setCluster={setCls}
              selector={selector}
              fetchLink="/api/obcors/subject"
            />
          </div>
        </FilterRow>

        <FilterRow onClick={stopPropagation}>
          <FilterLabel>题数</FilterLabel>
          <Slider
            value={[quizNum]}
            max={300}
            min={1}
            step={1}
            onValueChange={(value) => {
              if (
                Math.abs(value[0] - quizNum) > 5 ||
                value[0] === 1 ||
                value[0] === 300
              ) {
                handleQuizNumChange(value);
              }
            }}
            className="w-[80%]"
          />
          <StyledInput
            type="number"
            value={quizNum}
            onChange={handleInputChange}
            onClick={stopPropagation}
            min={1}
            max={300}
            disabled={isLoading}
          />
        </FilterRow>

        <FilterRow onClick={stopPropagation}>
          <FilterLabel>章节</FilterLabel>
          <div>
            <MultiSelectCombobox
              boxName="章节"
              cluster={unit}
              setCluster={setUnit}
              selector={selector}
              fetchLink="/api/obcors/unit"
            />
          </div>
        </FilterRow>

        <FilterRow onClick={stopPropagation}>
          <FilterLabel>题型</FilterLabel>
          <div onClick={stopPropagation}>
            <MultiSelectCombobox
              boxName="题型"
              cluster={mode}
              setCluster={setMode}
              selector={selector}
              fetchLink="/api/obcors/mode"
            />
          </div>
        </FilterRow>

        <FilterRow onClick={stopPropagation}>
          <FilterLabel>题源</FilterLabel>
          <div onClick={stopPropagation}>
            <MultiSelectCombobox
              boxName="题源"
              cluster={source}
              setCluster={setSource}
              selector={selector}
              fetchLink="/api/obcors/source"
              // stopPropagation={stopPropagation}
            />
          </div>
        </FilterRow>

        {/* <FilterRow onClick={stopPropagation}>
            <FilterLabel>仅未做过</FilterLabel>
            <input
              type="checkbox"
              checked={onlyHasDone}
              onChange={(e) => setOnlyHasDone(e.target.checked)}
              // onClick={stopPropagation}
            />
          </FilterRow> */}

        <FilterRow onClick={stopPropagation}>
          <FilterLabel>抽题模式</FilterLabel>
          <Tabs
            defaultValue="normal"
            value={reviewMode}
            onValueChange={(value) => setReviewMode(value as ReviewMode)}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="normal">随机抽题</TabsTrigger>
              <TabsTrigger value="unpracticed">仅未做</TabsTrigger>
              <TabsTrigger value="review">错题回顾</TabsTrigger>
            </TabsList>
          </Tabs>
        </FilterRow>
        <ReviewFilter
          reviewMode={reviewMode}
          scoringWeights={scoringWeights}
          setScoringWeights={setScoringWeights}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isLoading={isLoading}
          stopPropagation={stopPropagation}
        />

        {/* 标签筛选 */}
        <FilterRow onClick={stopPropagation}>
          <FilterLabel>标签筛选</FilterLabel>
          <div onClick={stopPropagation}>
            <MultiSelectCombobox
              boxName="标签"
              cluster={selectedTags}
              setCluster={setSelectedTags}
              selector={selector}
              fetchLink="/api/user/tags"
            />
          </div>
          <div onClick={stopPropagation}>
            <Select value={tagFilterMode} onValueChange={(value: "AND" | "OR") => setTagFilterMode(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">包含所有标签</SelectItem>
                <SelectItem value="OR">包含任一标签</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div onClick={stopPropagation}>
            <Select value={tagTypeFilter} onValueChange={(value: "all" | "private" | "public") => setTagTypeFilter(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                <SelectItem value="private">私有标签</SelectItem>
                <SelectItem value="public">公共标签</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterRow>

        {/* 排除标签筛选 */}
        <FilterRow onClick={stopPropagation}>
          <FilterLabel>排除标签</FilterLabel>
          <div onClick={stopPropagation}>
            <MultiSelectCombobox
              boxName="排除标签"
              cluster={excludeTags}
              setCluster={setExcludeTags}
              selector={selector}
              fetchLink="/api/user/tags"
            />
          </div>
          <div onClick={stopPropagation}>
            <Select value={excludeTagFilterMode} onValueChange={(value: "AND" | "OR") => setExcludeTagFilterMode(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">排除所有标签</SelectItem>
                <SelectItem value="OR">排除任一标签</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div onClick={stopPropagation}>
            <Select value={excludeTagTypeFilter} onValueChange={(value: "all" | "private" | "public") => setExcludeTagTypeFilter(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                <SelectItem value="private">私有标签</SelectItem>
                <SelectItem value="public">公共标签</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterRow>

        {/* 预设选择 */}
        <FilterRow onClick={stopPropagation}>
          <FilterLabel>预设</FilterLabel>
          <div className="flex items-center gap-2">
            {currentPreset ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentPreset.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCurrentPreset}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">无预设</span>
            )}
            <Dialog open={showPresetManager} onOpenChange={setShowPresetManager}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-1" />
                  标签管理
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl">
                <DialogHeader>
                  <DialogTitle>标签管理</DialogTitle>
                </DialogHeader>
                
                <Tabs value={activeTagTab} onValueChange={setActiveTagTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="presets">预设管理</TabsTrigger>
                    <TabsTrigger value="public">公共标签</TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-4">
                    {activeTagTab === "presets" && (
                      <TagPresetManager
                        selectedTags={selectedTags}
                        excludeTags={excludeTags}
                        tagFilterMode={tagFilterMode}
                        excludeTagFilterMode={excludeTagFilterMode}
                        onPresetSelect={handlePresetSelect}
                      />
                    )}
                    
                    {activeTagTab === "public" && (
                      <PublicTagManager
                        onTagSelect={(tag) => {
                          // 当选择公共标签时，添加到当前选中的标签
                          if (!selectedTags.includes(tag)) {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                      />
                    )}
                  </div>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </FilterRow>

        <SubmitButton onClick={submitSelector} disabled={false}>
          创建新试卷
        </SubmitButton>
      </FilterContainer>
    </>
  );
};

export default QuizFilterPanel;
