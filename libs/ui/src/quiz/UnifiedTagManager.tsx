import React, { useState, useEffect, useRef, useCallback } from "react";
import { Edit3, Trash2, Search, Check, X, Plus, Hash, Loader2, Lock, Globe } from "lucide-react";
import { Input } from "ui";
import { Button } from "ui";
import { Card, CardContent, CardHeader, CardTitle } from "ui";
import { Badge } from "ui";
import { toast } from "sonner";
import { QuizTag } from "quiz-shared";
import pinyin from "pinyin";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "ui";

interface Tag {
  value: string;
  type?: "private" | "public";
  createdAt?: Date;
  userId?: string;
  quizId?: string;
}

interface UnifiedTagManagerProps {
  quizId?: string;
  currentQuizIndex?: number;
  quizIndex?: number;
  onTagAdded?: (tag: Tag) => void;
  onTagRemoved?: (tagValue: string) => void;
  onTagUpdated?: () => void;
  existingTags?: Tag[];
  placeholder?: string;
  className?: string;
}

const UnifiedTagManager: React.FC<UnifiedTagManagerProps> = ({
  quizId,
  onTagAdded,
  onTagRemoved,
  onTagUpdated,
  currentQuizIndex,
  quizIndex,
  existingTags = [],
  placeholder = "添加标签...",
  className = "",
}) => {
  const [tags, setTags] = useState<QuizTag[]>([]);
  const [currentQuizTags, setCurrentQuizTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<QuizTag[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isResultsHovered, setIsResultsHovered] = useState(false);
  const hasFocusedRef = useRef(false);

  // Helper function to convert Chinese text to pinyin
  const getPinyin = useCallback((text: string, style?: any): string => {
    return pinyin(text, { style: style || pinyin.STYLE_NORMAL, heteronym: false })
      .flat()
      .join('');
  }, []);

  // Helper function to get pinyin initials
  const getPinyinInitials = useCallback((text: string): string => {
    return pinyin(text, { style: pinyin.STYLE_FIRST_LETTER, heteronym: false })
      .flat()
      .join('');
  }, []);

  // Helper function to check if a tag matches the search term
  const tagMatchesSearch = useCallback((tag: QuizTag, searchTerm: string): boolean => {
    if (!searchTerm.trim()) return true;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const tagValue = tag.value.toLowerCase();
    
    // Direct match
    if (tagValue.includes(lowerSearchTerm)) {
      return true;
    }
    
    // Check if search term is English letters (potential pinyin initials)
    if (/^[a-zA-Z]+$/.test(searchTerm)) {
      const tagPinyin = getPinyin(tag.value).toLowerCase();
      const tagPinyinInitials = getPinyinInitials(tag.value).toLowerCase();
      
      // Match full pinyin
      if (tagPinyin.includes(lowerSearchTerm)) {
        return true;
      }
      
      // Match pinyin initials
      if (tagPinyinInitials.includes(lowerSearchTerm)) {
        return true;
      }
    }
    
    return false;
  }, [getPinyin, getPinyinInitials]);

  // Helper function to sort tags by pinyin and English initials
  const sortTags = useCallback((tags: QuizTag[]): QuizTag[] => {
    return [...tags].sort((a, b) => {
      const aValue = a.value;
      const bValue = b.value;
      
      // Get pinyin for both tags
      const aPinyin = getPinyin(aValue).toLowerCase();
      const bPinyin = getPinyin(bValue).toLowerCase();
      
      // Compare by pinyin first
      if (aPinyin < bPinyin) return -1;
      if (aPinyin > bPinyin) return 1;
      
      // If pinyin is the same, compare by original value
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      
      return 0;
    });
  }, [getPinyin]);

  useEffect(() => {
    if(currentQuizIndex === quizIndex) {
      fetchUserTags();
      if (quizId) {
        fetchCurrentQuizTags();
      }
    }
    
  }, [currentQuizIndex]);

  const fetchCurrentQuizTags = async () => {
    try {
      const response = await fetch(`/api/quiz/${quizId}/tags`);
      if (response.ok) {
        const data = await response.json();
        setCurrentQuizTags(data.tags || []);
      } else {
        throw new Error("Failed to fetch current quiz tags");
      }
    } catch (error) {
      console.error("Error fetching current quiz tags:", error);
      toast.error("获取当前试题标签失败");
    }
  };

  useEffect(() => {
    // Filter tags using our enhanced matching function
    const filtered = tags.filter(tag => tagMatchesSearch(tag, searchTerm));
    // Sort the filtered tags by pinyin
    const sortedFiltered = sortTags(filtered);
    setFilteredTags(sortedFiltered);
  }, [tags, searchTerm]);

  // Sync inputValue with searchTerm when input changes
  useEffect(() => {
    setSearchTerm(inputValue);
  }, [inputValue]);

  const fetchUserTags = async () => {
    try {
      setIsLoading(true);
      // Fetch both user tags and public tags
      const [userTagsResponse, publicTagsResponse] = await Promise.all([
        fetch("/api/user/tags"),
        fetch("/api/tags/public")
      ]);
      
      let allTags: QuizTag[] = [];
      
      if (userTagsResponse.ok) {
        const userTags = await userTagsResponse.json();
        allTags = [...userTags];
      }
      
      if (publicTagsResponse.ok) {
        const publicTagsData = await publicTagsResponse.json();
        // Convert public tags to QuizTag format
        const publicTags: QuizTag[] = publicTagsData
          .filter((tag: any) => tag.isActive)
          .map((tag: any) => ({
            value: tag.name,
            type: "public" as const,
            createdAt: tag.createdAt,
            userId: tag.createdBy,
            quizId: ""
          }));
        allTags = [...allTags, ...publicTags];
      }
      
      // Sort all tags by pinyin
      const sortedTags = sortTags(allTags);
      setTags(sortedTags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast.error("获取标签列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTagSuggestions = async (query: string) => {
    setIsLoading(true);
    try {
      // Fetch both user tags and public tags for suggestions
      const [userTagsResponse, publicTagsResponse] = await Promise.all([
        fetch(`/api/user/tags`),
        fetch(`/api/tags/public?q=${encodeURIComponent(query)}`)
      ]);
      
      let allTags: QuizTag[] = [];
      
      if (userTagsResponse.ok) {
        const userTags = await userTagsResponse.json();
        allTags = [...userTags];
      }
      
      if (publicTagsResponse.ok) {
        const publicTagsData = await publicTagsResponse.json();
        // Convert public tags to QuizTag format
        const publicTags: QuizTag[] = publicTagsData
          .filter((tag: any) => tag.isActive)
          .map((tag: any) => ({
            value: tag.name,
            type: "public" as const,
            createdAt: tag.createdAt,
            userId: tag.createdBy,
            quizId: ""
          }));
        allTags = [...allTags, ...publicTags];
      }
      
      // Sort all tags by pinyin
      const sortedTags = sortTags(allTags);
      setTags(sortedTags);
    } catch (error) {
      console.error("Error fetching tag suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFocus = () => {
    setIsInputFocused(true);
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      fetchTagSuggestions("");
    }
  };

  const handleBlur = () => {
    // Only hide results if not hovering over them
    if (!isResultsHovered) {
      setIsInputFocused(false);
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

    if (!quizId) {
      // If no quizId provided, just add to user's tag list (for management only)
      toast.info("请在具体题目页面添加标签");
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
        fetchUserTags(); // Refresh the tag list
        if (quizId) {
          fetchCurrentQuizTags(); // Refresh current quiz tags
        }
        onTagUpdated?.();
        toast.success(`标签 "${tagValue}" 添加成功`);
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
  };

  const handleRenameTag = async (oldTagName: string, newTagName: string) => {
    if (!newTagName.trim() || oldTagName === newTagName) {
      setEditingTag(null);
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch("/api/user/tags/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "rename",
          oldTagName,
          newTagName: newTagName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setEditingTag(null);
        fetchUserTags();
        if (quizId) {
          fetchCurrentQuizTags(); // Refresh current quiz tags
        }
        onTagUpdated?.();
      } else {
        throw new Error(data.error || "重命名失败");
      }
    } catch (error) {
      console.error("Error renaming tag:", error);
      toast.error(error instanceof Error ? error.message : "重命名标签失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(`确定要删除标签 "${tagName}" 及其所有出现吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch("/api/user/tags/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          oldTagName: tagName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchUserTags();
        if (quizId) {
          fetchCurrentQuizTags(); // Refresh current quiz tags
        }
        onTagUpdated?.();
      } else {
        throw new Error(data.error || "删除失败");
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error(error instanceof Error ? error.message : "删除标签失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditing = (tagName: string) => {
    setEditingTag(tagName);
    setNewTagName(tagName);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setNewTagName("");
  };

  const handleRemoveCurrentQuizTag = async (tagValue: string) => {
    if (!quizId) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/quiz/${quizId}/tags`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag: tagValue }),
      });

      if (response.ok) {
        // Remove from local state
        setCurrentQuizTags(prev => prev.filter(tag => tag.value !== tagValue));
        if (onTagRemoved) {
          onTagRemoved(tagValue);
        }
        onTagUpdated?.();
        toast.success(`标签 "${tagValue}" 已移除`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "移除标签失败");
      }
    } catch (error) {
      console.error("Error removing tag:", error);
      toast.error(error instanceof Error ? error.message : "移除标签失败");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>标签管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent>
        <div className="space-y-4">
          {/* Current quiz tags */}
          {quizId && currentQuizTags.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">当前标签：</div>
              <div className="flex flex-wrap gap-2">
                {currentQuizTags.map((tag) => (
                  <Badge
                    key={tag.value}
                    variant={tag.type === "public" ? "default" : "secondary"}
                    className="group relative pr-6 cursor-pointer hover:bg-secondary/80 transition-colors"
                  >
                    {tag.type === "public" ? (
                      <Globe className="h-3 w-3 mr-1" />
                    ) : (
                      <Lock className="h-3 w-3 mr-1" />
                    )}
                    {tag.value}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCurrentQuizTag(tag.value);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      disabled={isProcessing}
                      title="删除标签"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Command Input for both adding tags and searching */}
          <div className="flex items-center gap-2 w-full">
            <div className="w-full">
              <Command
                shouldFilter={true}
                filter={(value, search) => {
                  // Find the tag that matches this value
                  const tag = tags.find(t => t.value === value);
                  if (!tag) return 0;
                  
                  // Use our existing matching function
                  return tagMatchesSearch(tag, search) ? 1 : 0;
                }}
                className="border rounded-md w-full"
              >
                <div className="flex items-center gap-2 w-full">
                  <CommandInput
                    placeholder={placeholder + " 或搜索标签..."}
                    value={inputValue}
                    onValueChange={(value) => {
                      setInputValue(value);
                      setSearchTerm(value);
                    }}
                    onFocus={handleFocus}
                    onBlur={(e) => {
                      // Prevent blur when clicking on dropdown items
                      if (!e.relatedTarget || !e.relatedTarget.closest('[cmdk-item]')) {
                        handleBlur();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (inputValue.trim()) {
                          handleAddTag();
                        }
                      }
                    }}
                    className="pr-10 w-full"
                  />
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  )}
                  <Button
                    onClick={handleAddTag}
                    disabled={isAddingTag || !inputValue.trim()}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 mr-2"
                    onMouseDown={(e) => {
                      // Prevent input from losing focus when clicking the button
                      e.preventDefault();
                    }}
                  >
                    {isAddingTag ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {(isInputFocused || isResultsHovered) && (
                  <CommandList
                    className="max-h-64"
                    onMouseEnter={() => setIsResultsHovered(true)}
                    onMouseLeave={() => setIsResultsHovered(false)}
                    onMouseDown={(e) => {
                      // Prevent input from losing focus when clicking on the dropdown
                      e.preventDefault();
                    }}
                  >
                    <CommandEmpty>
                      {searchTerm ? "没有找到匹配的标签" : "暂无标签"}
                    </CommandEmpty>
                    <CommandGroup>
                      {tags.map((tag) => (
                        <CommandItem
                          key={tag.value}
                          value={tag.value}
                          onSelect={() => {
                            setInputValue(tag.value);
                            // Keep the input focused after selection
                            setTimeout(() => {
                              const inputElement = document.querySelector('[cmdk-input]') as HTMLInputElement;
                              if (inputElement) {
                                inputElement.focus();
                              }
                            }, 0);
                          }}
                        >
                          {editingTag === tag.value ? (
                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="flex-1 h-8 text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.stopPropagation();
                                    handleRenameTag(tag.value, newTagName);
                                  } else if (e.key === "Escape") {
                                    e.stopPropagation();
                                    cancelEditing();
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditing();
                                }}
                                disabled={isProcessing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameTag(tag.value, newTagName);
                                }}
                                disabled={isProcessing || !newTagName.trim()}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-1">
                                {tag.type === "private" ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm font-medium">{tag.value}</span>
                                <span className="text-xs text-muted-foreground">({tag.type === "private" ? "私有" : "公开"})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(tag.value);
                                  }}
                                  disabled={isProcessing}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTag(tag.value);
                                  }}
                                  disabled={isProcessing}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <div className="text-xs text-muted-foreground p-2">
                      共 {tags.length} 个标签 {searchTerm && `（筛选出 ${tags.filter(tag => tagMatchesSearch(tag, searchTerm)).length} 个）`}
                    </div>
                  </CommandList>
                )}
              </Command>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedTagManager;

