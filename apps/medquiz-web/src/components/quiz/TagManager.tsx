import React, { useState, useEffect } from 'react';
import { Edit3, Trash2, Search, Check, X, Lock, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { QuizTag } from '@/lib/quiz/quizTagger';

interface TagManagerProps {
  onTagUpdated?: () => void;
}

const TagManager: React.FC<TagManagerProps> = ({ onTagUpdated }) => {
  const [tags, setTags] = useState<QuizTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<QuizTag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  ``;
  useEffect(() => {
    fetchUserTags();
  }, []);

  useEffect(() => {
    const filtered = tags.filter((tag) =>
      tag.value.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredTags(filtered);
  }, [tags, searchTerm]);

  const fetchUserTags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      } else {
        throw new Error('Failed to fetch tags');
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('获取标签列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameTag = async (oldTagName: string, newTagName: string) => {
    if (!newTagName.trim() || oldTagName === newTagName) {
      setEditingTag(null);
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('/api/user/tags/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rename',
          oldTagName,
          newTagName: newTagName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setEditingTag(null);
        fetchUserTags();
        onTagUpdated?.();
      } else {
        throw new Error(data.error || '重命名失败');
      }
    } catch (error) {
      console.error('Error renaming tag:', error);
      toast.error(error instanceof Error ? error.message : '重命名标签失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (
      !confirm(`确定要删除标签 "${tagName}" 及其所有出现吗？此操作不可撤销。`)
    ) {
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('/api/user/tags/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          oldTagName: tagName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchUserTags();
        onTagUpdated?.();
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error(error instanceof Error ? error.message : '删除标签失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditing = (tag: QuizTag) => {
    setEditingTag(tag.value);
    setNewTagName(tag.value);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setNewTagName('');
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
    <Card>
      <CardHeader>
        <CardTitle>标签管理</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {filteredTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? '没有找到匹配的标签' : '暂无标签'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredTags.map((tag) => (
                <div
                  key={tag.value}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  {editingTag === tag.value ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameTag(tag.value, newTagName);
                          } else if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditing}
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleRenameTag(tag.value, newTagName)}
                        disabled={isProcessing || !newTagName.trim()}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {tag.type === 'private' ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{tag.value}</span>
                        <span className="text-xs text-muted-foreground">
                          ({tag.type === 'private' ? '私有' : '公开'})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(tag)}
                          disabled={isProcessing}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTag(tag.value)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            共 {tags.length} 个标签{' '}
            {searchTerm && `（筛选出 ${filteredTags.length} 个）`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TagManager;
