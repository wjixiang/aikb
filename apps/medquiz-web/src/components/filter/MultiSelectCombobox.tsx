'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { quizSelector } from '@/types/quizSelector.types';
import { useEffect, useMemo, useState, useRef } from 'react';
import styled from 'styled-components';
import { ScrollArea } from '../ui/scroll-area';

const Tag = styled.div`
  border-radius: 16px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
`;

const TagContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
`;

const CloseButton = styled.span`
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  font-weight: bold;
  margin-left: 5px;

  &:hover {
    color: hsl(var(--destructive));
  }
`;

interface OptionType {
  value: string;
  label: string;
}

interface MultiSelectComboboxProps {
  boxName: string;
  cluster: string[] | null;
  setCluster: (cluster: string[]) => void;
  selector: quizSelector;
  fetchLink: string;
  // stopPropagation?: (e: React.MouseEvent) => void;
}

export function MultiSelectCombobox({
  boxName,
  cluster,
  setCluster,
  selector,
  fetchLink,
  // stopPropagation
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(''); // New state for CommandInput
  const [options, setOptions] = useState<OptionType[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const commandGroupRef = useRef<HTMLDivElement>(null);

  const memoizedSelector = useMemo(() => {
    return JSON.stringify(selector);
  }, [selector]);

  const fetchOptions = async () => {
    try {
      setIsLoadingOptions(true);

      if (fetchLink === '/api/user/tags') {
        // For tags, fetch both user tags and public tags
        const [userTagsResponse, publicTagsResponse] = await Promise.all([
          fetch('/api/user/tags'),
          fetch('/api/tags/public'),
        ]);

        let allOptions: OptionType[] = [];

        if (userTagsResponse.ok) {
          const userTags = await userTagsResponse.json();
          allOptions = [
            ...allOptions,
            ...userTags.map((tag: any) => ({
              value: tag.value,
              label: `${tag.value} (${tag.type === 'public' ? '公共' : '私有'})`,
            })),
          ];
        }

        if (publicTagsResponse.ok) {
          const publicTagsData = await publicTagsResponse.json();
          const publicTags = publicTagsData
            .filter((tag: any) => tag.isActive)
            .map((tag: any) => ({
              value: tag.name,
              label: `${tag.name} (公共)`,
            }));
          allOptions = [...allOptions, ...publicTags];
        }

        return allOptions;
      } else {
        // For other types, use the original logic
        const response = await fetch(fetchLink, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requestData: selector }),
        });
        const dataList: string[] = await response.json();

        return dataList.map((value) => ({
          value: value,
          label: value,
        }));
      }
    } catch (error) {
      console.error(`Error fetching ${boxName} options:`, error);
      return [];
    } finally {
      setIsLoadingOptions(false);
    }
  };

  useEffect(() => {
    const updateOptions = async () => {
      const newOptions = await fetchOptions();
      setOptions(newOptions);
    };

    updateOptions();
  }, [memoizedSelector]);

  const handleSelect = (currentValue: string) => {
    if (cluster?.includes(currentValue)) {
      setCluster(cluster.filter((item) => item !== currentValue));
    } else {
      setCluster([...(cluster || []), currentValue]);
    }
    setOpen(false);
  };

  const removeClusterItem = (itemToRemove: string) => {
    if (cluster) {
      setCluster(cluster.filter((item) => item !== itemToRemove));
    }
  };

  return (
    <div>
      <TagContainer>
        {cluster &&
          cluster.map((e, index) => (
            <Tag key={index}>
              {e}
              <CloseButton onClick={() => removeClusterItem(e)}>
                <X size={14} />
              </CloseButton>
            </Tag>
          ))}
      </TagContainer>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {cluster && cluster.length > 0
              ? cluster.join(', ')
              : `选择${boxName}...`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[200px] p-0"
          align="start"
          sideOffset={5}
          avoidCollisions={false}
          collisionPadding={10}
          style={{ pointerEvents: 'auto' }}
          onWheel={(e) => e.stopPropagation()} // Add this to stop scroll propagation
        >
          <Command>
            <CommandInput
              placeholder={`搜索${boxName}...`}
              className="h-9"
              onValueChange={(value) => {
                // New event listener
                setInputValue(value);
                console.log('CommandInput value:', value);
              }}
            />
            <CommandList style={{ maxHeight: '300px' }}>
              <CommandEmpty>无结果</CommandEmpty>
              <ScrollArea>
                <CommandGroup
                  ref={commandGroupRef}
                  style={{ height: '100%', overflow: 'auto' }}
                >
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        handleSelect(currentValue);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                    >
                      <Check
                        className={cn(
                          'ml-auto',
                          cluster?.includes(option.value)
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
