'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Save, Plus, Loader2 } from 'lucide-react';
import { TagPreset } from '@/types/quizSelector.types';

interface TagPresetManagerProps {
  selectedTags: string[];
  excludeTags: string[];
  tagFilterMode: 'AND' | 'OR';
  excludeTagFilterMode: 'AND' | 'OR';
  onPresetSelect: (preset: TagPreset) => void;
  className?: string;
}

export const TagPresetManager: React.FC<TagPresetManagerProps> = ({
  selectedTags,
  excludeTags,
  tagFilterMode,
  excludeTagFilterMode,
  onPresetSelect,
  className = '',
}) => {
  const { data: session } = useSession();
  const [presets, setPresets] = useState<TagPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');

  useEffect(() => {
    loadPresets();
  }, [session]);

  const loadPresets = async () => {
    if (!session?.user?.email) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/user/tags/presets');
      if (response.ok) {
        const data = await response.json();
        setPresets(data);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreset = async () => {
    if (!session?.user?.email || !newPresetName.trim()) return;

    try {
      setIsSaving(true);
      const presetData = {
        name: newPresetName.trim(),
        description: newPresetDescription.trim(),
        includeTags: selectedTags,
        excludeTags: excludeTags,
        includeTagFilterMode: tagFilterMode,
        excludeTagFilterMode: excludeTagFilterMode,
      };

      const response = await fetch('/api/user/tags/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(presetData),
      });

      if (response.ok) {
        setNewPresetName('');
        setNewPresetDescription('');
        loadPresets(); // 重新加载预设列表
      }
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!session?.user?.email) return;

    try {
      const response = await fetch(`/api/user/tags/presets?id=${presetId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadPresets(); // 重新加载预设列表
      }
    } catch (error) {
      console.error('Error deleting preset:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>标签预设</CardTitle>
          <CardDescription>加载中...</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="w-4 h-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>标签预设管理</CardTitle>
        <CardDescription>保存和加载常用的标签筛选组合</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 保存当前设置 */}
        <div className="space-y-2">
          <Label htmlFor="preset-name">保存当前设置</Label>
          <div className="flex gap-2">
            <Input
              id="preset-name"
              placeholder="预设名称"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={savePreset}
              disabled={!newPresetName.trim() || isSaving}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </Button>
          </div>
          <Input
            placeholder="描述（可选）"
            value={newPresetDescription}
            onChange={(e) => setNewPresetDescription(e.target.value)}
          />
        </div>

        {/* 预设列表 */}
        <div className="space-y-2">
          <Label>可用预设</Label>
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无预设</p>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset._id?.toString() || preset.name}
                  className="flex items-center justify-between p-2 border rounded-md hover:bg-accent"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{preset.name}</span>
                      {preset.isDefault && (
                        <span className="text-xs text-muted-foreground">
                          (默认)
                        </span>
                      )}
                    </div>
                    {preset.description && (
                      <p className="text-sm text-muted-foreground">
                        {preset.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {preset.includeTags.length > 0 && (
                        <span>包含: {preset.includeTags.join(', ')}</span>
                      )}
                      {preset.excludeTags.length > 0 && (
                        <span> | 排除: {preset.excludeTags.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPresetSelect(preset)}
                    >
                      应用
                    </Button>
                    {!preset.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          deletePreset(preset._id?.toString() || '')
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
