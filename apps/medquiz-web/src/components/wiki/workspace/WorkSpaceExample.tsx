import React from 'react';
import { WorkSpace } from './WorkSpace';
import './workspace.css';

/**
 * WorkSpace 使用示例
 *
 * 这个组件展示了如何使用 WorkSpace 组件来创建一个完整的
 * Markdown 文档浏览和编辑工作区。
 */
export const WorkSpaceExample: React.FC = () => {
  const handleDocumentOpen = (path: string) => {
    console.log('文档已打开:', path);
  };

  const handleDocumentClose = (path: string) => {
    console.log('文档已关闭:', path);
  };

  return (
    <div className="h-screen w-full bg-background">
      <div className="h-full p-4">
        <WorkSpace
          initialPath="README"
          basePath="/wiki"
          onDocumentOpen={handleDocumentOpen}
          onDocumentClose={handleDocumentClose}
          className="h-full border border-border rounded-lg shadow-lg"
        />
      </div>
    </div>
  );
};

// 在 Next.js 页面中使用
export const WikiPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold text-foreground mb-4">文档工作区</h1>
        <WorkSpace
          basePath="/wiki"
          className="h-[calc(100vh-120px)] shadow-lg rounded-lg border border-border"
        />
      </div>
    </div>
  );
};

// 在现有组件中使用
export const DocumentViewer: React.FC<{ documentPath?: string }> = ({
  documentPath,
}) => {
  return (
    <div className="h-full bg-background">
      <WorkSpace initialPath={documentPath} className="h-full" />
    </div>
  );
};
