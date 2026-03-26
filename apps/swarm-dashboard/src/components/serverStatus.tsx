import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  api,
  type HealthResponse,
  type MetricsResponse,
  type TaskStatsResponse,
  type AgentInfo,
} from '@/lib/api';
import {
  Activity,
  HardDrive,
  Clock,
  Users,
  ListTodo,
  Cpu,
  Server,
} from 'lucide-react';

interface ServerStatusData {
  health: HealthResponse | null;
  metrics: MetricsResponse | null;
  taskStats: TaskStatsResponse | null;
  runtimeAgents: AgentInfo[];
  topologySize: { nodes: number; edges: number };
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function ServerStatus() {
  const [data, setData] = useState<ServerStatusData>({
    health: null,
    metrics: null,
    taskStats: null,
    runtimeAgents: [],
    topologySize: { nodes: 0, edges: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metrics, health, taskStats, agentsRes, topologyRes] =
          await Promise.all([
            api.health.metrics().catch(() => null),
            api.health.get().catch(() => null),
            api.tasks.stats().catch(() => null),
            api.runtime.agents().catch(() => ({
              success: false,
              data: [],
              count: 0,
            })),
            api.runtime.topology().catch(() => ({
              success: false,
              data: {
                nodes: [],
                edges: [],
                size: { nodes: 0, edges: 0 },
              },
            })),
          ]);
        const runtimeAgents = agentsRes.success ? agentsRes.data : [];
        const topology = topologyRes.success ? topologyRes.data : null;
        setData({
          health,
          metrics,
          taskStats,
          runtimeAgents,
          topologySize: topology?.size ?? { nodes: 0, edges: 0 },
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="h-full w-full border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Server Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full w-full border-2 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Activity className="h-5 w-5" />
            Server Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const { health, metrics, taskStats, runtimeAgents, topologySize } = data;
  const server = metrics?.server;
  const tasks = taskStats?.data;

  return (
    <Card className="h-full w-full border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Server Status
          </span>
          <span
            className={`text-sm px-2 py-1 rounded ${
              health?.status === 'ok'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
            }`}
          >
            {health?.status ?? 'Unknown'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Uptime:</span>
            <span>{server ? formatUptime(server.uptime) : '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Host:</span>
            <span>{server ? server.system.hostname : '-'}</span>
          </div>
        </div>

        {/* CPU & System Memory */}
        {server && (
          <div className="border-t pt-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* CPU */}
              <div>
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <Cpu className="h-4 w-4" />
                  CPU
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {server.cpu.cores} cores &middot; load{' '}
                  {server.cpu.loadAvg[0].toFixed(1)} / {server.cpu.cores}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      server.cpu.usagePercent > 80
                        ? 'bg-red-500'
                        : server.cpu.usagePercent > 50
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(server.cpu.usagePercent, 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-right text-muted-foreground mt-0.5">
                  {server.cpu.usagePercent}%
                </div>
              </div>

              {/* System Memory */}
              <div>
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <HardDrive className="h-4 w-4" />
                  System Memory
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  {formatBytes(server.system.usedMemory)} /{' '}
                  {formatBytes(server.system.totalMemory)}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      server.system.usedMemory / server.system.totalMemory > 0.9
                        ? 'bg-red-500'
                        : server.system.usedMemory / server.system.totalMemory >
                            0.7
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.round((server.system.usedMemory / server.system.totalMemory) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-right text-muted-foreground mt-0.5">
                  Heap: {formatBytes(server.memory.heapUsed)} /{' '}
                  {formatBytes(server.memory.heapTotal)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Runtime Stats */}
        {(runtimeAgents.length > 0 || topologySize.nodes > 0) && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Runtime
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Agents:</span>
                <span>{runtimeAgents.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Connections:</span>
                <span>{topologySize.edges}</span>
              </div>
            </div>
          </div>
        )}

        {/* Task Stats */}
        {tasks && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <ListTodo className="h-4 w-4" />
              Tasks
            </div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div className="text-center p-2 bg-muted rounded">
                <div className="text-lg font-semibold">
                  {tasks.byStatus.pending}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-2 bg-blue-100 dark:bg-blue-900 rounded">
                <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {tasks.byStatus.processing}
                </div>
                <div className="text-xs text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-2 bg-green-100 dark:bg-green-900 rounded">
                <div className="text-lg font-semibold text-green-700 dark:text-green-300">
                  {tasks.byStatus.completed}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-2 bg-red-100 dark:bg-red-900 rounded">
                <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                  {tasks.byStatus.failed}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
          </div>
        )}

        {/* Server ID */}
        <div className="border-t pt-3 text-xs text-muted-foreground">
          Server ID: {health?.serverId ?? '-'}
        </div>
      </CardContent>
    </Card>
  );
}
