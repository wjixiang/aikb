"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, X } from "lucide-react";

export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export interface FilterColumn {
  id: string;
  title: string;
  options: FilterOption[];
  selectedValues?: string[];
  isLoading?: boolean;
}

export interface MultiColumnFilterProps {
  columns: FilterColumn[];
  onColumnChange: (columnId: string, selectedValues: string[]) => void;
  onClearFilters: () => void;
  className?: string;
}

export function MultiColumnFilter({
  columns,
  onColumnChange,
  onClearFilters,
  className,
}: MultiColumnFilterProps) {
  const handleValueChange = (
    columnId: string,
    value: string,
    isChecked: boolean,
  ) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    const currentSelected = column.selectedValues || [];
    let newSelectedValues: string[];

    if (isChecked) {
      newSelectedValues = [...currentSelected, value];
    } else {
      newSelectedValues = currentSelected.filter((v) => v !== value);
    }

    onColumnChange(columnId, newSelectedValues);
  };

  const handleClearColumn = (columnId: string) => {
    onColumnChange(columnId, []);
  };

  const hasActiveFilters = columns.some(
    (column) => column.selectedValues && column.selectedValues.length > 0,
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">多级过滤器</h2>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            清除所有过滤器
          </Button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column, index) => (
          <div key={column.id} className="flex-shrink-0 w-64">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {index > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    {column.title}
                  </CardTitle>
                  {column.selectedValues &&
                    column.selectedValues.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClearColumn(column.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72 px-4 pb-4">
                  {column.isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-sm text-muted-foreground">
                        加载中...
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {column.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`${column.id}-${option.id}`}
                            checked={
                              column.selectedValues?.includes(option.value) ||
                              false
                            }
                            onChange={(e) =>
                              handleValueChange(
                                column.id,
                                option.value,
                                e.target.checked,
                              )
                            }
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label
                            htmlFor={`${column.id}-${option.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
