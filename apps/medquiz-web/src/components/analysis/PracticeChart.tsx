"use client";

import { useEffect, useState, useRef } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface PracticeData {
  date: string;
  count: number;
  correctCount: number;
  accuracy?: number;
  // 添加按科目分类的数据
  subjectData?: {
    [subject: string]: {
      count: number;
      correctCount: number;
    };
  };
}

export function PracticeChart() {
  const [allData, setAllData] = useState<PracticeData[]>([]);
  const [displayData, setDisplayData] = useState<PracticeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState<number>(100);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [dateRange, setDateRange] = useState<string>("30"); // Default to 30 days
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [adaptiveYAxis, setAdaptiveYAxis] = useState<boolean>(true);
  const [accuracyDomain, setAccuracyDomain] = useState<[number, number]>([
    0, 100,
  ]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPracticeData = async () => {
      try {
        const practiceResponse = await fetch("/api/analysis/practice-analysis");

        if (!practiceResponse.ok)
          throw new Error("Failed to fetch practice data");
        const practiceData = await practiceResponse.json();

        // 提取所有可用的科目
        const subjects = new Set<string>();
        practiceData.forEach((item: any) => {
          if (item.subjectData) {
            Object.keys(item.subjectData).forEach((subject) =>
              subjects.add(subject),
            );
          }
        });
        setAvailableSubjects(Array.from(subjects));

        // 从数据中获取今日练习科目
        const today = new Date().toISOString().split("T")[0];
        const todayData = practiceData.find((item: any) => item.date === today);
        let todaySubjects: string[] = [];

        if (todayData?.subjectData) {
          todaySubjects = Object.entries(todayData.subjectData)
            .filter(([_, data]) => (data as any).count > 0)
            .map(([subject]) => subject);
        }

        // 优先选择今日练习科目，如果没有则选择所有科目
        setSelectedSubjects(
          todaySubjects.length > 0
            ? todaySubjects.filter((subject) => subjects.has(subject))
            : Array.from(subjects),
        );

        // 计算每天的正确率
        const dataWithAccuracy = practiceData.map((item: any) => ({
          ...item,
          accuracy:
            item.count > 0
              ? Math.round((item.correctCount / item.count) * 100)
              : 0,
        }));

        // Sort data by date (ascending)
        const sortedData = dataWithAccuracy.sort(
          (
            a: { date: string | number | Date },
            b: { date: string | number | Date },
          ) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        setAllData(sortedData);
        console.log("All fetched and sorted data:", sortedData);
      } catch (error) {
        console.error("Error fetching practice data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPracticeData();
  }, []);

  // Filter data based on selected date range
  useEffect(() => {
    if (allData.length > 0) {
      const days = parseInt(dateRange, 10);

      // Calculate the cutoff date (beginning of the day)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      cutoffDate.setHours(0, 0, 0, 0); // Set to the beginning of the day

      // Filter data after or on the cutoff date
      const filteredData = allData.filter((item) => {
        const itemDate = new Date(item.date);
        // Set itemDate to the beginning of its day for accurate comparison
        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= cutoffDate;
      }); // Corrected closing parenthesis for filter

      setDisplayData(filteredData);
      console.log("Data after date range filtering:", filteredData);
    }
  }, [allData, dateRange]);

  // Calculate chart width based on data points
  useEffect(() => {
    if (displayData.length > 0) {
      // Check if we need a wider chart based on data length
      const minWidthPerItem = 80; // Minimum width for each data point in pixels
      const calculatedWidth = Math.max(
        150,
        ((displayData.length * minWidthPerItem) / window.innerWidth) * 100,
      );
      setChartWidth(calculatedWidth);

      // Show scroll buttons if chart is wider than container
      setShowScrollButtons(calculatedWidth > 100);
    }
  }, [displayData, dateRange]);

  // 计算自适应Y轴的范围
  useEffect(() => {
    if (displayData.length > 0 && adaptiveYAxis) {
      const chartData = prepareSubjectData();

      // 收集所有可用的正确率数据点
      const allAccuracyValues: number[] = [];

      // 收集总体正确率
      chartData.forEach((day) => {
        if (typeof day.accuracy === "number" && !isNaN(day.accuracy)) {
          allAccuracyValues.push(day.accuracy);
        }
      });

      // 收集各科目正确率
      selectedSubjects.forEach((subject) => {
        chartData.forEach((day) => {
          const subjectAccuracy = day[`${subject}_accuracy`];
          if (typeof subjectAccuracy === "number" && !isNaN(subjectAccuracy)) {
            allAccuracyValues.push(subjectAccuracy);
          }
        });
      });

      if (allAccuracyValues.length > 0) {
        // 找出最小和最大正确率
        const minAccuracy = Math.min(...allAccuracyValues);
        const maxAccuracy = Math.max(...allAccuracyValues);

        // 计算一个合适的范围，留有一些余量
        const buffer = 5; // 上下各留5%的余量
        const lowerBound = Math.max(0, Math.floor(minAccuracy) - buffer);
        const upperBound = Math.min(100, Math.ceil(maxAccuracy) + buffer);

        // 设置新的Y轴范围
        setAccuracyDomain([lowerBound, upperBound]);
      } else {
        // 如果没有数据，使用默认范围
        setAccuracyDomain([0, 100]);
      }
    } else {
      // 如果不需要自适应或没有数据，使用默认范围
      setAccuracyDomain([0, 100]);
    }
  }, [displayData, selectedSubjects, adaptiveYAxis]);

  // Handle horizontal scrolling
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  // Handle date range change
  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    // Scroll to the beginning when changing date range
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  };

  // 处理科目选择变更
  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    );
  };

  // 获取热图颜色对应的CSS类名
  const getHeatmapColorClass = (value: number): string => {
    if (value === 0) return "color-empty";
    if (value <= 5) return "color-scale-1";
    if (value <= 10) return "color-scale-2";
    if (value <= 20) return "color-scale-3";
    if (value <= 30) return "color-scale-4";
    return "color-scale-5";
  };

  // 为图表准备带有科目分类的数据
  const prepareSubjectData = () => {
    console.log("Display data before preparing for chart:", displayData);
    console.log("Currently selected subjects:", selectedSubjects);
    if (!displayData.length || !selectedSubjects.length) return [];

    return displayData.map((day) => {
      // 为热图准备数据
      const heatmapData = selectedSubjects.map((subject) => {
        if (day.subjectData && day.subjectData[subject]) {
          return {
            subject,
            value: day.subjectData[subject].count,
            date: day.date,
          };
        }
        return {
          subject,
          value: 0,
          date: day.date,
        };
      });

      const result: Record<string, any> = {
        ...day,
        heatmapData,
      };

      // 为每个选定的科目计算正确率
      selectedSubjects.forEach((subject) => {
        if (day.subjectData && day.subjectData[subject]) {
          const { count, correctCount } = day.subjectData[subject];
          const accuracy =
            count > 0 ? Math.round((correctCount / count) * 100) : 0;
          // 只添加非零数据
          if (count > 0) {
            result[`${subject}_count`] = count;
            result[`${subject}_accuracy`] = accuracy;
          }
        }
      });

      console.log("Prepared data for chart for a day:", result);
      return result;
    });
  };

  // 为图表生成堆叠柱状图配置
  const generateBarConfig = () => {
    return selectedSubjects.map((subject, index) => {
      // 生成一组独特的颜色
      const colors = [
        "#8884d8",
        "#82ca9d",
        "#ffc658",
        "#ff8042",
        "#0088FE",
        "#00C49F",
        "#FFBB28",
        "#FF8042",
      ];
      return (
        <Bar
          key={subject}
          yAxisId="left"
          dataKey={`${subject}_count`}
          stackId="count"
          fill={colors[index % colors.length]}
          name={`${subject}练习数`}
        />
      );
    });
  };

  // 为图表生成各科目正确率的折线图
  const generateAccuracyLinesConfig = () => {
    return selectedSubjects.map((subject, index) => {
      // 生成一组独特的颜色，比柱状图颜色更亮些
      const colors = [
        "#8a2be2",
        "#00cc66",
        "#ff8c00",
        "#ff4500",
        "#1e90ff",
        "#00ced1",
        "#ffd700",
        "#da70d6",
      ];
      return (
        <Line
          key={`${subject}_accuracy`}
          yAxisId="right"
          type="monotone"
          dataKey={`${subject}_accuracy`}
          stroke={colors[index % colors.length]}
          name={`${subject}正确率`}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      );
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>每日练习统计</CardTitle>
          <CardDescription>加载中...</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <Skeleton className="w-full h-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = prepareSubjectData();
  console.log("Final chart data:", chartData);

  // Prepare heatmap data
  interface HeatmapValue {
    date: string | Date;
    count: number;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  oneYearAgo.setHours(0, 0, 0, 0);

  const yearScopedHeatmapData = allData.filter((item) => {
    const itemDate = new Date(item.date);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate >= oneYearAgo;
  });

  const heatmapData: HeatmapValue[] = yearScopedHeatmapData.map((item) => ({
    date: item.date,
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>每日练习统计</CardTitle>
          <CardDescription>显示您每天的练习次数和各科目正确率</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近7天</SelectItem>
              <SelectItem value="14">近14天</SelectItem>
              <SelectItem value="30">近30天</SelectItem>
              <SelectItem value="60">近60天</SelectItem>
              <SelectItem value="90">近90天</SelectItem>
              <SelectItem value="180">近半年</SelectItem>
              <SelectItem value="365">近一年</SelectItem>
              <SelectItem value="9999">全部</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Switch
              id="adaptive-y-axis"
              checked={adaptiveYAxis}
              onCheckedChange={setAdaptiveYAxis}
            />
            <Label htmlFor="adaptive-y-axis" className="text-xs">
              自适应比例
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 科目选择区域 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm font-medium">科目筛选:</span>
          {availableSubjects.map((subject) => (
            <button
              key={subject}
              onClick={() => toggleSubject(subject)}
              className={`px-2 py-1 text-xs rounded-full ${
                selectedSubjects.includes(subject)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
        <div className="relative">
          {showScrollButtons && (
            <>
              <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 z-10 bg-white/80 dark:bg-slate-800/80 rounded-full p-1 shadow-md -translate-y-1/2 hover:bg-white dark:hover:bg-slate-700"
                aria-label="向左滚动"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 z-10 bg-white/80 dark:bg-slate-800/80 rounded-full p-1 shadow-md -translate-y-1/2 hover:bg-white dark:hover:bg-slate-700"
                aria-label="向右滚动"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-hide pb-4"
            style={{
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div style={{ width: `${chartWidth}%`, minWidth: "100%" }}>
              {chartData.length > 0 ? (
                <div className="flex flex-col">
                  {/* 固定高度的图表区域 */}
                  <div style={{ height: "350px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          label={{
                            value: "练习次数",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={accuracyDomain}
                          label={{
                            value: "正确率 (%)",
                            angle: 90,
                            position: "insideRight",
                          }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (
                              typeof name === "string" &&
                              name.includes("练习数")
                            ) {
                              return [`${value} 次`, name];
                            }
                            if (
                              typeof name === "string" &&
                              name.includes("正确率")
                            ) {
                              return [`${value}%`, name];
                            }
                            return [value, name];
                          }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0)
                              return null;

                            // Case 1: Hovering over a data point on the chart
                            const dataPoint = payload[0].payload;
                            if (dataPoint && dataPoint.date) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-2 border border-gray-200 dark:border-slate-700 rounded shadow">
                                  <p className="font-medium">
                                    日期: {dataPoint.date}
                                  </p>
                                  {payload.map((entry, index) => (
                                    <p
                                      key={`item-${index}`}
                                      style={{ color: entry.color }}
                                    >
                                      {entry.name || "数据项"}:{" "}
                                      {entry.name?.includes("正确率")
                                        ? `${entry.value}%`
                                        : `${entry.value} 次`}
                                    </p>
                                  ))}
                                </div>
                              );
                            }

                            // Case 2: Hovering over a legend item
                            const legendItem = payload[0];
                            if (legendItem && legendItem.name) {
                              return (
                                <div className="bg-white dark:bg-slate-800 p-2 border border-gray-200 dark:border-slate-700 rounded shadow">
                                  <p className="font-medium">
                                    {legendItem.name}
                                  </p>
                                </div>
                              );
                            }

                            return null;
                          }}
                        />
                        <Legend
                          content={({ payload }) => {
                            if (!payload) return null;
                            return (
                              <div className="custom-legend flex flex-wrap justify-center gap-x-4 gap-y-2">
                                {payload
                                  .filter((item) => {
                                    if (!item.value || !item.dataKey)
                                      return false;
                                    // 过滤掉值为0的图例项
                                    const dataKey = item.dataKey.toString();
                                    return chartData.some(
                                      (data) => data[dataKey] > 0,
                                    );
                                  })
                                  .map((item, index) => (
                                    <div
                                      key={`legend-${index}`}
                                      className="flex items-center"
                                    >
                                      <div
                                        style={{
                                          width: item.value.includes("正确率")
                                            ? "12px"
                                            : "12px",
                                          height: item.value.includes("正确率")
                                            ? "2px"
                                            : "12px",
                                          backgroundColor: item.color,
                                          marginRight: "8px",
                                        }}
                                      ></div>
                                      <span className="text-sm">
                                        {item.value}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            );
                          }}
                        />
                        {generateBarConfig()}
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#ff7300"
                          name="整体正确率"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        {generateAccuracyLinesConfig()}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[350px]">
                  <p className="text-gray-500">所选时间范围内没有练习数据</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Heatmap */}
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">练习日历热力图</h3>
          <div className="overflow-x-auto">
            <CalendarHeatmap
              startDate={
                new Date(new Date().setFullYear(new Date().getFullYear() - 1))
              }
              endDate={new Date()}
              values={heatmapData}
              classForValue={(value) => {
                const typedValue = value as HeatmapValue | null | undefined;
                if (!typedValue || !typedValue.count) return "color-empty";
                return getHeatmapColorClass(typedValue.count);
              }}
              tooltipDataAttrs={(value): Record<string, string> => {
                const typedValue = value as HeatmapValue | null | undefined;
                if (!typedValue || !typedValue.date) return {};
                const dateStr = new Date(typedValue.date).toLocaleDateString();
                return {
                  "data-tooltip-id": "heatmap-tooltip",
                  "data-tooltip-content": `${dateStr}\n练习次数: ${typedValue.count}次`,
                  "data-tooltip-place": "top",
                };
              }}
              showWeekdayLabels
              onClick={(value) => {
                const typedValue = value as HeatmapValue | null | undefined;
                if (typedValue) {
                  // Scroll to the date in the main chart if clicked
                  const dateElement = document.querySelector(
                    `[data-date="${typedValue.date}"]`,
                  );
                  if (dateElement && scrollContainerRef.current) {
                    dateElement.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                      inline: "center",
                    });
                  }
                }
              }}
            />
            <ReactTooltip
              id="heatmap-tooltip"
              className="z-50 max-w-[200px] bg-white dark:bg-slate-800 text-black dark:text-white border border-gray-200 dark:border-slate-700 rounded shadow p-2 whitespace-pre-line"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
