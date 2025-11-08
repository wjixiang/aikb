
"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Edit, Plus, Search, Filter, Loader2, MoreHorizontal } from "lucide-react";
import { PublicTag, CreatePublicTagRequest, UpdatePublicTagRequest } from "@/types/quizSelector.types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface PublicTagManagerProps {
  className?: string;
  onTagSelect?: (tag: string) => void;
}

export const PublicTagManager: React.FC<PublicTagManagerProps> = ({
  className = "",
  onTagSelect
}) => {
  const { data: session } = useSession();
  const [tags, setTags] = useState<PublicTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<PublicTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentTag, setCurrentTag] = useState<PublicTag | null>(null);
  
  // Form state
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [tagCategory, setTagCategory] = useState("");
  const [tagColor, setTagColor] = useState("");
  const [tagActive, setTagActive] = useState(true);

  // Available categories (could be fetched from API or hardcoded)
  const availableCategories = [
    "subject",
    "difficulty",
    "topic",
    "type",
    "source",
    "custom"
  ];

  useEffect(() => {
    loadTags();
  }, [session]);

  useEffect(() => {
    filterTags();
  }, [tags, searchQuery, categoryFilter, statusFilter]);

  const loadTags = async () => {
    if (!session?.user?.email) return;
    
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (categoryFilter !== 'all') queryParams.append('category', categoryFilter);
      if (statusFilter !== 'all') queryParams.append('includeInactive', 'true');
      
      const response = await fetch(`/api/tags/public?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error("Error loading public tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTags = () => {
    let filtered = [...tags];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(tag => 
        tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tag.description && tag.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(tag => tag.category === categoryFilter);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      const activeFilter = statusFilter === 'active';
      filtered = filtered.filter(tag => tag.isActive === activeFilter);
    }
    
    setFilteredTags(filtered);
  };

  const resetForm = () => {
    setTagName("");
    setTagDescription("");
    setTagCategory("");
    setTagColor("");
    setTagActive(true);
    setCurrentTag(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditDialogOpen(true);
  };

  const openEditDialog = (tag: PublicTag) => {
    setCurrentTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description || "");
    setTagCategory(tag.category || "");
    setTagColor(tag.color || "");
    setTagActive(tag.isActive);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (tag: PublicTag) => {
    setCurrentTag(tag);
    setDeleteDialogOpen(true);
  };

  const handleCreateTag = async () => {
    if (!session?.user?.email || !tagName.trim()) return;
    
    try {
      setIsCreating(true);
      const tagData: CreatePublicTagRequest = {
        name: tagName.trim(),
        description: tagDescription.trim() || undefined,
        category: tagCategory.trim() || undefined,
        color: tagColor.trim() || undefined
      };

      const response = await fetch("/api/tags/public", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tagData),
      });

      if (response.ok) {
        resetForm();
        setEditDialogOpen(false);
        loadTags(); // Reload tags
      } else {
        const errorData = await response.json();
        console.error("Error creating tag:", errorData.error);
      }
    } catch (error) {
      console.error("Error creating tag:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!session?.user?.email || !currentTag?._id || !tagName.trim()) return;
    
    try {
      setIsEditing(true);
      const updateData: UpdatePublicTagRequest = {
        name: tagName.trim(),
        description: tagDescription.trim() || undefined,
        category: tagCategory.trim() || undefined,
        color: tagColor.trim() || undefined,
        isActive: tagActive
      };

      const response = await fetch(`/api/tags/public/${currentTag._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        resetForm();
        setEditDialogOpen(false);
        loadTags(); // Reload tags
      } else {
        const errorData = await response.json();
        console.error("Error updating tag:", errorData.error);
      }
    } catch (error) {
      console.error("Error updating tag:", error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!session?.user?.email || !currentTag?._id) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/tags/public/${currentTag._id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        loadTags(); // Reload tags
      } else {
        const errorData = await response.json();
        console.error("Error deleting tag:", errorData.error);
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!session?.user?.email || selectedTags.length === 0) return;
    
    try {
      setIsDeleting(true);
      // Delete tags one by one (could be optimized with batch API)
      const deletePromises = selectedTags.map(tagId => 
        fetch(`/api/tags/public/${tagId}`, { method: "DELETE" })
      );
      
      await Promise.all(deletePromises);
      setSelectedTags([]);
      loadTags(); // Reload tags
    } catch (error) {
      console.error("Error bulk deleting tags:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTagSelect = (tag: PublicTag) => {
    if (onTagSelect) {
      onTagSelect(tag.name);
    }
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const selectAllTags = () => {
    if (selectedTags.length === filteredTags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags(filteredTags.map(tag => tag._id?.toString() || ""));
    }
  };

  const isAdmin = session?.user?.role === 'admin';

  if (!isAdmin) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>公共标签管理</CardTitle>
          <CardDescription>需要管理员权限访问</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">您没有权限访问公共标签管理功能。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">公共标签管理</h2>
          <p className="text-muted-foreground">管理系统范围内的公共标签</p>
        </div>
        
        <div className="flex gap-2">
          {selectedTags.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              删除选中 ({selectedTags.length})
            </Button>
          )}
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            新建标签
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">搜索标签</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="搜索标签名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">分类</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="所有分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分类</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="所有状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">非活跃</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle>标签列表</CardTitle>
          <CardDescription>
            共 {filteredTags.length} 个标签 {searchQuery && `(搜索: "${searchQuery}")`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' 
                ? "没有找到匹配的标签" 
                : "暂无公共标签"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedTags.length === filteredTags.length && filteredTags.length > 0}
                      onChange={selectAllTags}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>使用次数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTags.map((tag) => (
                  <TableRow key={tag._id?.toString() || tag.name} className="group">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag._id?.toString() || "")}
                        onChange={() => toggleTagSelection(tag._id?.toString() || "")}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {tag.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        {tag.name}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {tag.description || "-"}
                    </TableCell>
                    <TableCell>
                      {tag.category ? (
                        <Badge variant="outline">{tag.category}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tag.usageCount > 0 ? "default" : "secondary"}>
                        {tag.usageCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tag.isActive ? "default" : "secondary"}>
                        {tag.isActive ? "活跃" : "非活跃"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tag.createdAt ? new Date(tag.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTagSelect(tag)}
                          title="使用此标签"
                        >
                          使用
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(tag)}>
                              <Edit className="w-4 h-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => openDeleteDialog(tag)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {currentTag ? "编辑公共标签" : "新建公共标签"}
            </DialogTitle>
            <DialogDescription>
              {currentTag ? "修改标签信息" : "创建新的公共标签"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">标签名称 *</Label>
              <Input
                id="name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="输入标签名称"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={tagDescription}
                onChange={(e) => setTagDescription(e.target.value)}
                placeholder="输入标签描述（可选）"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">分类</Label>
              <Select value={tagCategory} onValueChange={setTagCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">无分类</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color">颜色</Label>
              <Input
                id="color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
                placeholder="#000000（十六进制颜色，可选）"
              />
            </div>

            {currentTag && (
              <div className="grid gap-2">
                <Label htmlFor="active">状态</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={tagActive}
                    onChange={(e) => setTagActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="active" className="cursor-pointer">
                    活跃
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={currentTag ? handleUpdateTag : handleCreateTag}
              disabled={!tagName.trim() || isCreating || isEditing}
            >
              {(isCreating || isEditing) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {currentTag ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除标签 &quot;{currentTag?.name}&quot; 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>

          {currentTag && currentTag.usageCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800 text-sm">
                警告：此标签已被使用 {currentTag.usageCount} 次，删除可能会影响相关数据。
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTag}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
