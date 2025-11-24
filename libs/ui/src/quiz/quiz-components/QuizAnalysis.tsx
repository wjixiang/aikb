import React from "react";
import { Card, CardContent } from "ui";
import {MarkdownRenderer} from "ui";

interface QuizAnalysisProps {
  point?: string | null;
  discuss?: string | null;
  links?: string[] | null;
  aiAnalysis?: string | null;
}

export const QuizAnalysis: React.FC<QuizAnalysisProps> = ({
  point,
  discuss,
  links,
  aiAnalysis,
}) => {
  return (
    <>
      {point && (
        <div className="space-y-2 mt-4">
          <h4 className="text-sm font-medium text-muted-foreground">
            要点
          </h4>
          <CardContent className="p-0 text-foreground">
            <MarkdownRenderer content={point} />
          </CardContent>
          <div className="border-b border-border/50"></div>
        </div>
      )}

      {discuss && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            解析
          </h4>
          <CardContent className="p-0 text-foreground">
            <MarkdownRenderer content={discuss} />
          </CardContent>
        </div>
      )}

      {links && links.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            相关链接
          </h4>
          <ul className="space-y-1">
            {links.map((link: string, index: number) => (
              <li key={index}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  参考资料 {index + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiAnalysis && (
        <Card className="bg-background text-foreground p-4 space-y-4">
          <CardContent className="p-0">
            <h4 className="text-lg font-semibold mb-2">AI分析</h4>
            <div className="text-foreground">
              <MarkdownRenderer content={aiAnalysis} />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};