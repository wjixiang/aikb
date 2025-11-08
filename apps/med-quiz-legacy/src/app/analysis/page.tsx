"use client";
import { PracticeChart } from "@/components/analysis/PracticeChart";
import SubjectPieChart from "@/components/analysis/SubjectPieChart";
import ChunkMasteryVisualization from "@/components/analysis/ChunkMasteryVisualization";
import RelatedChunks from "@/components/analysis/RelatedChunks";
import ErrorBoundary from "@/components/ErrorBoundary"; // Import the ErrorBoundary component
import { useState } from "react"; // Keep useState if other components use it, otherwise remove

// No longer need ChunkMasteryData import here as it's handled internally by ChunkMasteryVisualization
// import { ChunkMasteryData } from "@/types/analysis";

export default function DashboardPage() {
  // Removed chunkMasteryData and loading states as they are now handled within ChunkMasteryVisualization
  // const [chunkMasteryData, setChunkMasteryData] = useState<ChunkMasteryData[]>([]);
  // const [loading, setLoading] = useState(true);

  // Removed useEffect for data fetching as it's now handled within ChunkMasteryVisualization

  // Removed loading check as it's handled within ChunkMasteryVisualization
  // if (loading) {
  //   return <div className="container mx-auto py-8">加载中...</div>;
  // }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">学习仪表盘</h1>
      <div className="flex-auto overflow-y-auto">
        <div className="pb-2">
          <PracticeChart />
        </div>
        <SubjectPieChart />
        {/* Wrap ChunkMasteryVisualization with ErrorBoundary */}
        {/* <ErrorBoundary fallback={<div className="text-red-500">无法加载知识点掌握度可视化图表。</div>}>
          <ChunkMasteryVisualization /> 
        </ErrorBoundary> */}
        {/* <RelatedChunks /> */}
        {/* 其他仪表盘组件 */}
      </div>
    </div>
  );
}
