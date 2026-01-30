'use client';

import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { ReviewMode } from '@/types/quizSelector.types';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

type ReviewFilterProps = {
  reviewMode: ReviewMode;
  scoringWeights: {
    errorRate: number;
    consecutiveWrong: number;
    recency: number;
  };
  setScoringWeights: React.Dispatch<
    React.SetStateAction<{
      errorRate: number;
      consecutiveWrong: number;
      recency: number;
    }>
  >;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  isLoading: boolean;
  stopPropagation: (e: React.MouseEvent) => void;
};

const ReviewFilter = ({
  reviewMode,
  scoringWeights,
  setScoringWeights,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isLoading,
  stopPropagation,
}: ReviewFilterProps) => {
  const updateScoringWeights = useCallback(
    (key: 'errorRate' | 'consecutiveWrong' | 'recency', newValue: number) => {
      setScoringWeights((prev) => {
        const newWeights = { ...prev, [key]: newValue / 100 }; // Convert to 0-1 range

        // Calculate the sum of all weights
        let currentSum =
          newWeights.errorRate +
          newWeights.consecutiveWrong +
          newWeights.recency;

        // If the sum is already 1 (or very close due to floating point), no adjustment needed
        if (Math.abs(currentSum - 1) < 0.0001) {
          return newWeights;
        }

        // Calculate the difference from 1
        const diff = currentSum - 1;

        // Identify the other two weights
        const otherKeys = (
          ['errorRate', 'consecutiveWrong', 'recency'] as const
        ).filter((k) => k !== key);
        const [key1, key2] = otherKeys;

        // Calculate the sum of the other two weights
        const totalOther = newWeights[key1] + newWeights[key2];

        if (totalOther === 0) {
          // If the other two are zero, and the current one is not 1,
          // we need to adjust. If the new value is 1, then others remain 0.
          // If new value is less than 1, distribute remaining equally.
          if (newWeights[key] > 1) {
            return { ...prev, [key]: 1 }; // Cap the current one if it somehow exceeds 1
          } else if (newWeights[key] < 1) {
            const remaining = (1 - newWeights[key]) / 2;
            return {
              ...newWeights,
              [key1]: remaining,
              [key2]: remaining,
            };
          }
          return newWeights;
        }

        // Distribute the difference proportionally among the other two weights
        const adjustedKey1 =
          newWeights[key1] - diff * (newWeights[key1] / totalOther);
        const adjustedKey2 =
          newWeights[key2] - diff * (newWeights[key2] / totalOther);

        // Ensure values don't go below 0
        newWeights[key1] = Math.max(0, adjustedKey1);
        newWeights[key2] = Math.max(0, adjustedKey2);

        // Re-normalize if capping caused sum to deviate again (due to Math.max(0, ...))
        currentSum =
          newWeights.errorRate +
          newWeights.consecutiveWrong +
          newWeights.recency;
        if (Math.abs(currentSum - 1) > 0.0001) {
          const reNormalizeFactor = 1 / currentSum;
          newWeights.errorRate *= reNormalizeFactor;
          newWeights.consecutiveWrong *= reNormalizeFactor;
          newWeights.recency *= reNormalizeFactor;
        }

        return newWeights;
      });
    },
    [setScoringWeights],
  );

  return (
    <AnimatePresence mode="wait">
      {reviewMode === 'review' && (
        <motion.div
          key="reviewContent"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{ width: '100%' }} // Ensure it takes full width
        >
          <FilterRow onClick={stopPropagation}>
            <FilterLabel>日期范围</FilterLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn(
                    'w-[300px] justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    endDate ? (
                      <>
                        {format(startDate, 'PPP')} - {format(endDate, 'PPP')}
                      </>
                    ) : (
                      format(startDate, 'PPP')
                    )
                  ) : (
                    <span>选择日期</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={startDate}
                  selected={{ from: startDate, to: endDate }}
                  onSelect={(range) => {
                    if (range?.from) {
                      const start = new Date(range.from);
                      start.setHours(0, 0, 0, 0); // Set to beginning of the day
                      setStartDate(start);
                    } else {
                      setStartDate(undefined);
                    }
                    if (range?.to) {
                      const end = new Date(range.to);
                      end.setHours(23, 59, 59, 999); // Set to end of the day
                      setEndDate(end);
                    } else {
                      setEndDate(undefined);
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </FilterRow>

          <FilterRow onClick={stopPropagation}>
            <FilterLabel>错误率权重</FilterLabel>
            <Slider
              value={[scoringWeights.errorRate * 100]}
              max={100}
              min={0}
              step={1}
              onValueChange={(value) =>
                updateScoringWeights('errorRate', value[0])
              }
              className="w-[80%]"
            />
            <StyledInput
              type="number"
              value={Math.round(scoringWeights.errorRate * 100)}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  updateScoringWeights('errorRate', value);
                }
              }}
              onClick={stopPropagation}
              min={0}
              max={100}
              disabled={isLoading}
            />
          </FilterRow>

          <FilterRow onClick={stopPropagation}>
            <FilterLabel>连续错误权重</FilterLabel>
            <Slider
              value={[scoringWeights.consecutiveWrong * 100]}
              max={100}
              min={0}
              step={1}
              onValueChange={(value) =>
                updateScoringWeights('consecutiveWrong', value[0])
              }
              className="w-[80%]"
            />
            <StyledInput
              type="number"
              value={Math.round(scoringWeights.consecutiveWrong * 100)}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  updateScoringWeights('consecutiveWrong', value);
                }
              }}
              onClick={stopPropagation}
              min={0}
              max={100}
              disabled={isLoading}
            />
          </FilterRow>

          <FilterRow onClick={stopPropagation}>
            <FilterLabel>时间权重</FilterLabel>
            <Slider
              value={[scoringWeights.recency * 100]}
              max={100}
              min={0}
              step={1}
              onValueChange={(value) =>
                updateScoringWeights('recency', value[0])
              }
              className="w-[80%]"
            />
            <StyledInput
              type="number"
              value={Math.round(scoringWeights.recency * 100)}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  updateScoringWeights('recency', value);
                }
              }}
              onClick={stopPropagation}
              min={0}
              max={100}
              disabled={isLoading}
            />
          </FilterRow>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewFilter;
