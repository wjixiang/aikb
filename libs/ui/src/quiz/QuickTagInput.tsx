import React, { useState, useRef } from "react";
import { Plus, X, Loader2, Hash } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "ui";
import { useDebounce } from "./quiz-hooks/useDebounce";
import { QuizTag } from "quiz-shared";

interface Tag {
  value: string;
  type?: "private" | "public";
  createdAt?: Date;
  userId?: string;
  quizId?: string;
}

interface QuickTagInputProps {
  quizId: string;
  onTagAdded?: (tag: Tag) => void;
  onTagRemoved?: (tagValue: string) => void;
  existingTags?: Tag[];
  placeholder?: string;
  className?: string;
}

const QuickTagInput: React.FC<QuickTagInputProps> = ({
  quizId,
  onTagAdded,
  onTagRemoved,
  existingTags = [],
  placeholder = "添加标签...",
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [numberedText, setNumberedText] = useState("");
  const hasFocusedRef = useRef(false)

  // Debounce input value for suggestions
  const debouncedInputValue = useDebounce(inputValue, 300);

  const handleFocus = () => {
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      fetchTagSuggestions(""); // 首次聚焦时获取所有标签建议
    }
  };

  const fetchTagSuggestions = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/user/tags`);
      if (response.ok) {
        const data: QuizTag[] = await response.json();
        // Extract just the tag values for suggestions
        setSuggestions(data.map(tag => tag.value));
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error fetching tag suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!inputValue.trim() || isAddingTag) return;

    const tagValue = inputValue.trim();
    
    // Check if tag already exists
    const tagExists = existingTags.some(tag => tag.value.toLowerCase() === tagValue.toLowerCase());
    if (tagExists) {
      if (onTagRemoved) {
        onTagRemoved("该标签已存在");
      }
      setInputValue("");
      return;
    }

    setIsAddingTag(true);
    try {
      const response = await fetch(`/api/quiz/${quizId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag: tagValue }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTag = data.tag;
        
        if (onTagAdded) {
          onTagAdded(newTag);
        }
        
        setInputValue("");
        setShowSuggestions(false);
      } else {
        const errorData = await response.json();
        if (onTagRemoved) {
          onTagRemoved(errorData.error || "添加标签失败");
        }
      }
    } catch (error) {
      console.error("Error adding tag:", error);
      if (onTagRemoved) {
        onTagRemoved("网络错误，请稍后重试");
      }
    } finally {
      setIsAddingTag(false);
    }
  };


  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    // Auto-add if suggestion is selected
    setTimeout(() => {
      handleAddTag();
    }, 100);
  };

  const handleAddNumberedText = () => {
    // Generate numbered text like "1. ", "2. ", etc.
    const number = numberedText ? parseInt(numberedText) + 1 : 1;
    setNumberedText(number.toString());
    const numberedTag = `${number}. `;
    setInputValue(numberedTag);
    // Auto-add the numbered tag
    setTimeout(() => {
      handleAddTag();
    }, 100);
  };

  const handleClearNumberedText = () => {
    setNumberedText("");
  };

  return (
    <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
      <PopoverTrigger asChild>
        <div className={`flex items-center gap-1 ${className}`}>
          <div className="relative w-40">   {/* 1. 相对定位容器 */}
  <input
    value={inputValue}
    onChange={(e) => setInputValue(e.target.value)}
    onFocus={handleFocus}
    placeholder={placeholder}
    className="
      w-full            /* 撑满容器 */
      h-8               /* 统一高度，方便计算 */
      pr-8              /* 3. 右侧留 2rem(8*0.25=2rem) 给插槽，保证文字不重叠 */
      pl-2
      text-xs
      bg-white dark:bg-slate-800
      border border-slate-300 dark:border-slate-600
      rounded-md
      focus:ring-2 focus:ring-blue-500 focus:border-transparent
      transition-all duration-200
      placeholder:text-slate-400 dark:placeholder:text-slate-500
    "
  />

  {/* 2. 内部右侧插槽 */}
  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
    {isLoading ? (
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    ) : (
      <button
        onClick={handleAddTag}
        disabled={isAddingTag || !inputValue.trim()}
        className="
          w-6 h-6
          rounded-md
          bg-gradient-to-r from-blue-500 to-blue-600
          hover:from-blue-600 hover:to-blue-700
          text-white
          shadow-sm hover:shadow-md
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center
        "
      >
        {isAddingTag ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
      </button>
    )}
  </div>
</div>
          
          
        </div>
      </PopoverTrigger>
      
      {showSuggestions && suggestions.length > 0 && (
        <PopoverContent
          className="w-48 p-0 mt-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"
          align="start"
        >
          <div className="max-h-48 overflow-y-auto py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                data-suggestion-index={index}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-150 focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-600 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

export default QuickTagInput;
