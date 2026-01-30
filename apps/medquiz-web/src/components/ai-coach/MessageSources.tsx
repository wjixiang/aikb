'use client';
import { useEffect, useState } from 'react';
import { EmbedPDF } from '@simplepdf/react-embed-pdf';

import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '../ui/button';
import { Fullscreen, Shrink } from 'lucide-react';

interface MessageSourcesProps {
  sources: Array<{
    title: string;
    score: number;
    content: string;
    presigned_url: string;
  }>;
  content?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function MessageSources({
  sources,
  content,
  onFullscreenChange,
}: MessageSourcesProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (onFullscreenChange) {
      onFullscreenChange(isFullscreen);
    }
  }, [isFullscreen, onFullscreenChange]);
  const [pdfHeight, setPdfHeight] = useState(600);
  const [pdfWidth, setPdfWidth] = useState(100);
  const [showAllSources, setShowAllSources] = useState(false);

  useEffect(() => {
    const calculateHeight = () => {
      // Calculate height based on window height minus some padding
      const newHeight = Math.min(window.innerHeight * 0.7, 800);
      setPdfWidth(window.innerWidth);
      setPdfHeight(newHeight);
    };

    // Set initial height
    calculateHeight();

    // Add resize listener
    window.addEventListener('resize', calculateHeight);

    // Cleanup
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);
  // Extract reference indices from content if provided
  const refIndices = content
    ? [...content.matchAll(/\[ref:(\d+)\]/g)].map((match) => parseInt(match[1]))
    : null;

  const filteredSources = sources.filter(
    (_, idx) => !refIndices || refIndices.includes(idx + 1),
  );

  const displayedSources = showAllSources ? sources : filteredSources;

  return (
    <div className="w-full">
      <div className="flex justify-end mb-2">
        <Toggle
          pressed={showAllSources}
          onPressedChange={setShowAllSources}
          variant="outline"
          size="sm"
        >
          {showAllSources ? '显示过滤来源' : '显示全部来源'}
        </Toggle>
      </div>
      <Accordion type="multiple" className="w-full">
        {displayedSources.map((source, idx) => {
          const originalIndex = sources.indexOf(source);
          return (
            <AccordionItem
              key={originalIndex}
              value={`item-${originalIndex}`}
              className="border-none"
            >
              <AccordionTrigger className="p-3 hover:no-underline">
                <div className="flex flex-wrap justify-between items-start gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">来源 {originalIndex + 1}</Badge>
                    <p className="text-muted-foreground text-xs break-words truncate hover:text-clip hover:whitespace-normal">
                      {source.title}
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary">
                          相关度: {(source.score * 100).toFixed(1)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>文档与查询的相关性分数</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-3 pt-0 text-sm">
                {/* <div className="p-2 bg-muted rounded text-xs"> */}
                {/* {source.content} */}
                {source.presigned_url ? (
                  <div
                    className={isFullscreen ? 'fixed inset-0 z-50' : 'relative'}
                  >
                    <div
                      className={`${isFullscreen ? '' : 'mt-4'} w-full overflow-hide ${isFullscreen ? 'absolute left-0 top-0 w-full h-full bg-background' : ''}`}
                      onScroll={(e) => e.stopPropagation()}
                    >
                      <Button
                        className="absolute top-2 right-2 z-100 p-1 text-foreground bg-blend-difference"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                      >
                        {isFullscreen ? <Shrink /> : <Fullscreen />}
                      </Button>
                      {/* <div className= {`${isFullscreen ? "w-[100vh]": `${pdfHeight}px`}`}> */}
                      <EmbedPDF
                        // className='-mt-[132px]'
                        companyIdentifier="react-viewer"
                        mode="inline"
                        style={{
                          width: '100%',
                          height: isFullscreen ? '100vh' : `${pdfHeight}px`,
                          // maxWidth: isFullscreen ? '100vw' : undefined
                        }}
                        documentURL={source.presigned_url}
                      />
                      {/* </div> */}
                    </div>
                  </div>
                ) : null}
                {/* </div> */}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
