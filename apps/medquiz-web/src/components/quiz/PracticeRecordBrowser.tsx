'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { PracticeRecord } from '@/lib/quiz/QuizStorage';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuizComponent from './Quiz';
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { RefreshCcw, Eye, EyeClosed } from 'lucide-react';
import { toast } from 'sonner';

interface PracticeRecordWithQuiz extends PracticeRecord {
  quizData?: any; // Will be populated with quiz data
}

export interface PracticeRecordBrowserRef {
  refresh: () => void;
}

const PracticeRecordBrowser = forwardRef<PracticeRecordBrowserRef>(
  (props, ref) => {
    const [records, setRecords] = useState<PracticeRecordWithQuiz[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper function to get option content instead of just the index
    const getOptionContent = (
      options: { oid: string; text: string }[] | undefined,
      selectrecord: any,
      quizType: string,
    ) => {
      if (!options || selectrecord === undefined) {
        return selectrecord;
      }

      try {
        // Handle different data structures for selectrecord
        let optionIds: string[] = [];

        if (Array.isArray(selectrecord)) {
          // If it's already an array of option IDs
          optionIds = selectrecord;
        } else if (typeof selectrecord === 'string') {
          // If it's a single option ID string
          optionIds = [selectrecord];
        } else if (typeof selectrecord === 'object' && selectrecord !== null) {
          // If it's an object (for A3/B type questions)
          optionIds = Object.values(selectrecord);
        } else {
          // Fallback: convert to string and try to handle
          optionIds = [String(selectrecord)];
        }

        // Convert option IDs to their text content
        const optionTexts = optionIds.map((optionId) => {
          const option = options.find((opt) => opt.oid === optionId);
          return option ? option.text : optionId;
        });

        return optionTexts.join(', ');
      } catch (error) {
        console.error('Error processing selectrecord:', error);
        return selectrecord;
      }
    };

    // Expose refresh function to parent components
    useImperativeHandle(ref, () => ({
      refresh: () => {
        fetchRecords();
      },
    }));

    // Listen for quiz submission events to refresh the records
    useEffect(() => {
      const handleQuizSubmitted = () => {
        fetchRecords();
      };

      window.addEventListener('quizSubmitted', handleQuizSubmitted);
      return () => {
        window.removeEventListener('quizSubmitted', handleQuizSubmitted);
      };
    }, []);

    // Initial fetch when component mounts
    useEffect(() => {
      fetchRecords();
    }, []);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      return { from: sevenDaysAgo, to: today };
    });
    const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to descending
    const [showSubmitted, setShowSubmitted] = useState(false);
    const [needsRefresh, setNeedsRefresh] = useState(false);

    // Fetch records when sort order changes
    useEffect(() => {
      fetchRecords();
    }, [sortOrder]);
    const toggleShowSubmitted = () => {};
    const fetchRecords = async () => {
      if (!dateRange?.from || !dateRange?.to) return;

      try {
        setLoading(true);
        setError(null);
        setNeedsRefresh(false);

        const startDate = dateRange.from.toISOString();
        const endDate = dateRange.to.toISOString();

        const response = await fetch(
          `/api/quiz/history?startDate=${startDate}&endDate=${endDate}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        let recordsWithQuizData: PracticeRecord[] = await response.json();

        // Apply sorting based on sortOrder prop
        recordsWithQuizData = recordsWithQuizData.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        setRecords(recordsWithQuizData);
      } catch (err) {
        console.error('Failed to fetch practice records:', err);
        setError('Failed to load practice records');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !dateRange && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd, y')} -{' '}
                      {format(dateRange.to, 'LLL dd, y')}
                    </>
                  ) : (
                    format(dateRange.from, 'LLL dd, y')
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  setNeedsRefresh(true);
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Toggle
            aria-label="Toggle sort order"
            pressed={sortOrder === 'desc'}
            onPressedChange={() => {
              setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            }}
          >
            {sortOrder === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Toggle>
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as 'all' | 'correct' | 'wrong');
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="correct">Correct</TabsTrigger>
              <TabsTrigger value="wrong">Wrong</TabsTrigger>
            </TabsList>
          </Tabs>
          <Toggle
            pressed={showSubmitted}
            onPressedChange={(pressed) => {
              setShowSubmitted(pressed);
              toast.info(
                `Submitted questions are now ${pressed ? 'shown' : 'hidden'}`,
              );
            }}
            aria-label="Toggle submitted questions"
          >
            {showSubmitted ? <Eye /> : <EyeClosed />}
          </Toggle>

          <Button
            onClick={fetchRecords}
            disabled={loading}
            className={cn('bg-transparent', {
              'border-2 border-blue-500': needsRefresh,
            })}
          >
            {loading ? (
              'Loading...'
            ) : (
              <RefreshCcw
                className={cn({
                  'animate-spin': loading,
                })}
              />
            )}
          </Button>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <Accordion type="multiple" className="w-full">
          {records
            .filter((record) => {
              if (filter === 'correct') return record.correct;
              if (filter === 'wrong') return !record.correct;
              return true; // 'all'
            })
            .map((record) => (
              <AccordionItem
                key={record._id.toString()}
                value={record._id.toString()}
              >
                <AccordionTrigger>
                  <div className="flex items-center gap-4">
                    <span
                      className={
                        record.correct ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {record.correct ? '✓' : '✗'}
                    </span>
                    <span>{format(record.timestamp, 'yyyy-MM-dd HH:mm')}</span>
                    <span>{record.quizData?.class || 'No subject'}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {record.quizData ? (
                    <QuizComponent
                      quiz={{
                        ...record.quizData,
                        userAnswer: showSubmitted
                          ? getOptionContent(
                              record.quizData.options,
                              record.selectrecord,
                              record.quizData.type,
                            )
                          : undefined,
                      }}
                      currentQuizIndex={0}
                      thisQuizIndex={0}
                      back={() => {}}
                      forward={() => {}}
                      handleBackToGrid={() => {}}
                      onAnswerChange={async () => {}}
                      onSimilarQuizzesFound={() => {}}
                    />
                  ) : (
                    <div>Quiz data not available</div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>

        {records.length === 0 && !loading && (
          <div className="text-center text-gray-500">
            No practice records found for selected date range
          </div>
        )}
      </div>
    );
  },
);

PracticeRecordBrowser.displayName = 'PracticeRecordBrowser';

export default PracticeRecordBrowser;
