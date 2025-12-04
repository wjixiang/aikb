import React, { useState, KeyboardEvent } from 'react';
import { PlusCircle } from 'lucide-react';
import styled from 'styled-components';
import { Input } from '@/components/ui/input';

interface OptionType {
  value: string;
  label: string;
}

interface TagInputProps {
  placeholder?: string;
  quizId: string;
  onTagAdded?: () => void;
}

const TagInput: React.FC<TagInputProps> = ({
  placeholder = 'Add tags...',
  quizId,
  onTagAdded,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/quiz/${quizId}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tag: inputValue.trim() }),
        });

        if (!response.ok) {
          throw new Error('Failed to add tag');
        }

        await response.json(); // Consume the response
        setInputValue('');
        setIsInputVisible(false); // Hide input after adding tag
        if (onTagAdded) {
          onTagAdded();
        }
      } catch (error) {
        console.error('Error adding tag:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (e.key === 'Escape') {
      setInputValue('');
      setIsInputVisible(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {!isInputVisible ? (
        <PlusCircle
          size={20}
          onClick={() => setIsInputVisible(true)}
          style={{ cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
        />
      ) : (
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          onBlur={() => {
            if (!inputValue.trim()) {
              setIsInputVisible(false);
            }
          }}
          style={{ width: '150px', height: '32px', padding: '4px 8px' }}
        />
      )}
    </div>
  );
};

export default TagInput;
