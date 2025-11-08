import React, { useEffect, useState, useCallback } from "react";
import { ChunkMasteryData } from "@/types/analysis"; // Import from shared types
import { Chart as ChartJS, registerables } from "chart.js";
import { Chart } from "react-chartjs-2";
import { TreemapController, TreemapElement } from "chartjs-chart-treemap";
import { useSession } from "next-auth/react"; // Import useSession

// Register Chart.js components and the Treemap
ChartJS.register(...registerables, TreemapController, TreemapElement);

interface ChunkMasteryVisualizationProps {
  // No props needed as data fetching is internal
}

const ChunkMasteryVisualization: React.FC<
  ChunkMasteryVisualizationProps
> = () => {
  const [chunkMasteryData, setChunkMasteryData] = useState<ChunkMasteryData[]>(
    [],
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session, status } = useSession(); // Get session and status

  const fetchData = useCallback(async () => {
    if (status === "loading") {
      // Session is still loading, do nothing yet
      return;
    }

    if (status === "unauthenticated") {
      // User is not authenticated, set error and stop loading
      setLoading(false);
      setError("Unauthorized: Please log in to view chunk mastery data.");
      setChunkMasteryData([]);
      return;
    }

    // Only fetch if authenticated
    if (status === "authenticated") {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const startDate = thirtyDaysAgo.toISOString().split("T")[0]; // Format YYYY-MM-DD
        const endDate = today.toISOString().split("T")[0]; // Format YYYY-MM-DD

        const response = await fetch(
          `/api/analysis/chunk-mastery?startDate=${startDate}&endDate=${endDate}&refresh=true`,
          {
            credentials: "include", // Include cookies (e.g., session tokens) with the request
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Error fetching chunk mastery data: ${response.status} ${response.statusText} - ${errorText}`,
          );
        }

        const data: ChunkMasteryData[] = await response.json();
        setChunkMasteryData(data);

        // Cache the data with timestamp
        try {
          localStorage.setItem(
            "chunkMasteryData",
            JSON.stringify({
              data,
              timestamp: new Date().toISOString(),
            }),
          );
          setLastUpdated(new Date().toLocaleString());
        } catch (err) {
          console.error("Failed to cache data:", err);
        }
      } catch (err: any) {
        console.error("Failed to fetch chunk mastery data:", err);
        setError(err.message || "Failed to load chunk mastery data.");
        setChunkMasteryData([]); // Ensure data is empty on error
      } finally {
        setLoading(false);
      }
    }
  }, [status]);

  useEffect(() => {
    // Try to load cached data first
    const loadCachedData = () => {
      try {
        const cached = localStorage.getItem("chunkMasteryData");
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          setChunkMasteryData(data);
          setLastUpdated(new Date(timestamp).toLocaleString());
        }
      } catch (err) {
        console.error("Failed to load cached data:", err);
      }
    };

    loadCachedData();
    fetchData();
  }, [fetchData]); // Re-run effect when fetchData changes

  if (loading || status === "loading") {
    return <div className="text-center py-4">加载知识点掌握度数据...</div>;
  }

  if (error) {
    // ErrorBoundary will catch this, but we can also show a message here if not wrapped
    throw new Error(error); // Re-throw to be caught by the ErrorBoundary
  }

  // Prepare data for the Treemap
  const chartData = {
    datasets: [
      {
        data: chunkMasteryData.map((chunk, index) => {
          console.log("Chunk data in frontend:", chunk); // Add this log
          if (!chunk) {
            console.warn("Undefined chunk at index:", index);
            return {
              chunkId: `missing-${index}`,
              value: 0,
              accuracy: 0,
              chunkTitle: "Invalid Chunk",
            };
          }
          return {
            chunkId: chunk._id || `no-id-${index}`,
            value: typeof chunk.exposure === "number" ? chunk.exposure : 0,
            accuracy: typeof chunk.accuracy === "number" ? chunk.accuracy : 0,
            chunkTitle:
              chunk.chunkTitle ||
              (chunk._id
                ? `Chunk ${chunk._id.substring(0, 8)}...`
                : `Untitled Chunk ${index + 1}`),
          };
        }),
        key: "value",
        groups: ["chunkTitle"],
        spacing: 1,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.8)",
        backgroundColor: (context: any) => {
          if (
            !context.raw ||
            typeof context.raw.accuracy === "undefined" ||
            context.raw.accuracy === null
          ) {
            return "rgba(0, 0, 0, 0.1)"; // Default for parent nodes or if accuracy is missing
          }
          const accuracy = Number(context.raw.accuracy); // Ensure it's a number
          if (isNaN(accuracy)) {
            return "rgba(0, 0, 0, 0.1)"; // Fallback if accuracy is not a valid number
          }
          // Color based on accuracy: green for high, red for low
          const r = Math.floor(255 * (1 - accuracy));
          const g = Math.floor(255 * accuracy);
          return `rgba(${r}, ${g}, 0, 0.8)`;
        },
        labels: {
          display: true,
          formatter: (context: any) => context.raw.chunkTitle,
          font: {
            size: 12,
            weight: "bold" as const, // Explicitly cast to literal type
          },
          color: "white",
        },
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          title: (context: any) => context[0].raw.chunkTitle,
          label: (context: any) => {
            console.log("Tooltip context:", context); // Add this log
            return `Exposure: ${context.raw._data.value}, Accuracy: ${context.formattedValue}`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">知识掌握分布</h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              最后更新: {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading ? "更新中..." : "刷新数据"}
          </button>
        </div>
      </div>
      {chunkMasteryData.length === 0 ? (
        <p className="text-gray-600">暂无知识掌握数据。</p>
      ) : (
        <div style={{ height: "500px", width: "100%" }}>
          <Chart type="treemap" data={chartData} options={options} />
        </div>
      )}
    </div>
  );
};

export default ChunkMasteryVisualization;
