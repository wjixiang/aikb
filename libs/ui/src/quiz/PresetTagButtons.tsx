import React, { useState } from 'react';
import { Button } from 'ui';
import { Loader2 } from 'lucide-react';

interface Tag {
  value: string;
  createdAt?: Date;
  userId?: string;
  quizId?: string;
}

interface PresetTagButtonsProps {
  quizId: string;
  presetTags: string[];
  existingTags: Tag[];
  onTagAdded?: (tag: Tag) => void;
  onTagRemoved?: (tagValue: string) => void;
  className?: string;
}

const PresetTagButtons: React.FC<PresetTagButtonsProps> = ({
  quizId,
  presetTags,
  existingTags,
  onTagAdded,
  onTagRemoved,
  className = '',
}) => {
  const [isAddingTag, setIsAddingTag] = useState(false);

  const handlePresetTagClick = async (presetTag: string) => {
    // 检查标签是否已存在
    const tagExists = existingTags.some(
      (tag) => tag.value.toLowerCase() === presetTag.toLowerCase(),
    );
    if (tagExists) {
      if (onTagRemoved) {
        onTagRemoved('该标签已存在');
      }
      return;
    }

    setIsAddingTag(true);
    try {
      // Determine tag type based on preset tag format or by checking if it's a public tag
      let tagType = 'private';

      // Check if this is a public tag by fetching public tags
      const publicTagsResponse = await fetch('/api/tags/public');
      if (publicTagsResponse.ok) {
        const publicTags = await publicTagsResponse.json();
        const isPublicTag = publicTags.some(
          (tag: any) =>
            tag.isActive && tag.name.toLowerCase() === presetTag.toLowerCase(),
        );
        if (isPublicTag) {
          tagType = 'public';
        }
      }

      const response = await fetch(`/api/quiz/${quizId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag: presetTag, type: tagType }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTag = data.tag;

        if (onTagAdded) {
          onTagAdded(newTag);
        }
      } else {
        const errorData = await response.json();
        if (onTagRemoved) {
          onTagRemoved(errorData.error || '添加标签失败');
        }
      }
    } catch (error) {
      console.error('Error adding preset tag:', error);
      if (onTagRemoved) {
        onTagRemoved('网络错误，请稍后重试');
      }
    } finally {
      setIsAddingTag(false);
    }
  };

  if (!presetTags || presetTags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {presetTags.map((presetTag, index) => (
        <Button
          key={index}
          onClick={() => handlePresetTagClick(presetTag)}
          disabled={isAddingTag}
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          title={`添加标签: ${presetTag}`}
        >
          {isAddingTag ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            presetTag
          )}
        </Button>
      ))}
    </div>
  );
};

export default PresetTagButtons;
