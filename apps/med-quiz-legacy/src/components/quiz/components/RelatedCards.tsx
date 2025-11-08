import React from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MarkdownRenderer from "@/components/wiki/DocumentDisplay";

interface RelatedCardsProps {
  submitted: boolean;
  loading: boolean;
  error: string | null;
  cards: any[] | null;
}

export const RelatedCards: React.FC<RelatedCardsProps> = ({
  submitted,
  loading,
  error,
  cards,
}) => {
  if (!submitted) return null;

  return (
    <Card className="mt-4 p-4">
      <CardTitle className="text-lg font-semibold mb-2">相关卡片</CardTitle>
      <CardContent>
        {loading && <p>加载相关卡片中...</p>}
        {error && <p className="text-red-500">加载失败: {error}</p>}
        {cards && cards.length === 0 && !loading && <p>没有找到相关卡片。</p>}
        {cards && cards.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {cards.map((card: any, index: number) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>
                  {card.content.split("\n")[0].substring(0, 100)}...
                </AccordionTrigger>
                <AccordionContent>
                  <MarkdownRenderer content={card.content} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
