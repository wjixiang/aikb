"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface SourceStats {
  source: string;
  practiced: number;
  total: number;
}

interface SubjectStats {
  subject: string;
  practiced: number;
  total: number;
  percentage: number;
  sources?: SourceStats[]; // Make sources optional
}

export default function SubjectPieChart() {
  const [data, setData] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSubjects] = useState<string[]>([
    "生理学",
    "病理学",
    "内科学",
    "外科学",
    "生物化学与分子生物学",
    "人文精神",
    "诊断学",
    "儿科学",
    "妇产科学",
    "精神病学",
    "神经病学",
    "传染病学",
    "眼科学",
    "流行病学",
  ]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // 处理科目选择
  const handleSubjectSelect = (subject: string) => {
    if (!selectedSubjects.includes(subject)) {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  // 处理科目移除
  const handleSubjectRemove = (subject: string) => {
    setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
  };

  // 清除所有选择
  const handleClearAll = () => {
    setSelectedSubjects([]);
  };

  // 获取统计数据
  useEffect(() => {
    const fetchData = async (retryCount = 0) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 60秒超时

        // 构建查询参数
        const params = new URLSearchParams();
        if (selectedSubjects.length > 0) {
          params.append("subjects", selectedSubjects.join(","));
        }

        const response = await fetch(
          `/api/analysis/subject-stats-with-sources?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 500 && retryCount < 3) {
            // 服务器错误时重试
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (retryCount + 1)),
            );
            return fetchData(retryCount + 1);
          }
          throw new Error(`Failed to fetch subject stats: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching subject stats:", error);
        if (
          retryCount < 3 &&
          (error instanceof Error || error instanceof DOMException) &&
          error.name !== "AbortError"
        ) {
          // 非超时错误重试
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (retryCount + 1)),
          );
          return fetchData(retryCount + 1);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSubjects]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学科练习统计</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <Skeleton className="w-full h-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0 && selectedSubjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学科练习统计</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex flex-col items-center justify-center">
          <p className="text-gray-500 mb-4">请选择要查看的学科</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                选择学科
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                {allSubjects.slice(0, 6).map((subject) => (
                  <DropdownMenuCheckboxItem
                    key={subject}
                    onCheckedChange={() => handleSubjectSelect(subject)}
                  >
                    {subject}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    );
  }

  const OUTER_COLORS = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#8AC24A",
    "#F06292",
    "#7986CB",
    "#A1887F",
  ];

  const INNER_COLORS = [
    "#FFB6C1",
    "#87CEFA",
    "#FFFACD",
    "#AFEEEE",
    "#C9A0DC",
    "#FFD39B",
    "#C1E1C1",
    "#F8BBD0",
    "#B39DDB",
    "#BCAAA4",
  ];

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);

  return (
    <div>
      {/* 科目选择区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>选择学科</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 已选择的科目 */}
            {selectedSubjects.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">已选择的学科:</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedSubjects.map((subject) => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {subject}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleSubjectRemove(subject)}
                      />
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="mt-2"
                >
                  清除所有选择
                </Button>
              </div>
            )}

            {/* 可选择的科目 */}
            <div>
              <p className="text-sm font-medium mb-2">可选择的学科:</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    选择学科
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuGroup>
                    {allSubjects
                      .filter((subject) => !selectedSubjects.includes(subject))
                      .map((subject) => (
                        <DropdownMenuCheckboxItem
                          key={subject}
                          onCheckedChange={() => handleSubjectSelect(subject)}
                        >
                          {subject}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedData.map((subjectData, idx) => (
          <Card key={subjectData.subject}>
            <CardHeader>
              <CardTitle>{subjectData.subject}</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Outer Pie - Total by source (only show if sources exist) */}
                  {subjectData.sources && subjectData.sources.length > 0 && (
                    <Pie
                      data={subjectData.sources.map((source) => ({
                        name: source.source,
                        value: source.total,
                        practiced: source.practiced,
                        total: source.total,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {subjectData.sources.map((entry, index) => (
                        <Cell
                          key={`cell-outer-${index}`}
                          fill={OUTER_COLORS[index % OUTER_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  )}

                  {/* Inner Pie - Completed vs Remaining */}
                  <Pie
                    data={[
                      {
                        name: "已完成",
                        value: subjectData.percentage,
                        practiced: subjectData.practiced,
                        total: subjectData.total,
                      },
                      {
                        name: "未完成",
                        value: 100 - subjectData.percentage,
                        practiced: subjectData.total - subjectData.practiced,
                        total: subjectData.total,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={50}
                    innerRadius={0}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell
                      key="cell-completed"
                      fill={INNER_COLORS[idx % INNER_COLORS.length]}
                    />
                    <Cell key="cell-remaining" fill="#e0e0e0" />
                  </Pie>

                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      if (props.payload.payload?.source) {
                        // Source tooltip
                        return [
                          `${value}题`,
                          `${name} (完成${props.payload.practiced}题)`,
                        ];
                      } else {
                        // Completion tooltip
                        return [
                          `${(props.payload.practiced / value).toFixed(2)}%`,
                          `${name} (${props.payload.practiced}/${props.payload.total})`,
                        ];
                      }
                    }}
                  />
                  {!subjectData.sources && (
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#666"
                    >
                      无来源数据
                    </text>
                  )}
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
