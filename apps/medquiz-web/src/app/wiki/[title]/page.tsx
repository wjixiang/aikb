'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MarkdownRenderer from '@/components/wiki/DocumentDisplay';

export default function WikiPage() {
  const params = useParams();
  const [markdownContent, setMarkdownContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 修改这一行，使用与文件夹名相同的参数名
  const title = params.title; // 如果文件夹是 [title]
  console.log(params);
  // 或者
  // const id = params.id; // 如果文件夹是 [id]

  useEffect(() => {
    // 确保参数已经可用
    if (!title) return; // 使用与上面相同的变量名

    async function fetchMarkdown() {
      try {
        // 使用与上面相同的变量名
        const response = await fetch(`/api/note/fetch?title=${title}`);
        if (!response.ok) throw new Error('笔记获取失败');
        const data = await response.json();
        console.log(data);
        const markdownName = data.fileName;
        const markdownCotent =
          data.content[data.content.length - 1].fileContent;
        setMarkdownContent(markdownCotent);
        setNoteTitle(markdownName);
      } catch (error) {
        console.error('Failed to fetch markdown:', error);
        setError(String(error));
      } finally {
        setIsLoading(false);
      }
    }

    fetchMarkdown();
  }, [title]); // 更新依赖项

  if (isLoading) {
    return (
      <div className="loading-state p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state p-4 border border-red-300 bg-red-50 rounded-md">
        <h2 className="text-xl font-bold text-red-700 mb-2">出错了</h2>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          重试
        </button>
      </div>
    );
  }

  // if (!article) {
  //   return (
  //     <div className="not-found p-4 border border-yellow-300 bg-yellow-50 rounded-md">
  //       <h2 className="text-xl font-bold text-yellow-700 mb-2">文章不存在</h2>
  //       <p className="text-yellow-600">找不到ID为 {id} 的文章。</p>
  //     </div>
  //   );
  // }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isLoading ? 'Loading...' : noteTitle}
      </h1>

      {isLoading ? (
        <div>加载中...</div>
      ) : (
        <div className="bg-background p-1 rounded-lg overflow-auto">
          <MarkdownRenderer
            content={markdownContent}
            className="prose max-w-none"
          />
        </div>
      )}
    </div>
  );
}
