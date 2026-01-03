import * as React from 'react';
import { TaskStatus } from 'MedAgent-service/graphql';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { LayoutGrid, List } from 'lucide-react';

export interface TaskInfo {
  id: string;
  taskStatus: TaskStatus;
  taskInput: string;
}

type ViewMode = 'card' | 'list';

interface TaskListProps {
  tasks: TaskInfo[];
  loading?: boolean;
  error?: Error | null;
  onTaskClick?: (taskId: string) => void;
  onStartTask?: (taskId: string) => Promise<void>;
  startingTaskId?: string;
}

const getStatusBadgeVariant = (
  status: TaskStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 'default';
    case TaskStatus.RUNNING:
      return 'secondary';
    case TaskStatus.ABORTED:
      return 'destructive';
    case TaskStatus.IDLE:
    default:
      return 'outline';
  }
};

const getStatusColor = (status: TaskStatus): string => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 'bg-green-500';
    case TaskStatus.RUNNING:
      return 'bg-blue-500';
    case TaskStatus.ABORTED:
      return 'bg-red-500';
    case TaskStatus.IDLE:
    default:
      return 'bg-gray-500';
  }
};

const TaskCard = ({ task, onClick, onStartTask, isStarting }: {
  task: TaskInfo;
  onClick?: () => void;
  onStartTask?: (e: React.MouseEvent, taskId: string) => Promise<void>;
  isStarting?: boolean;
}) => (
  <Card
    className={`hover:shadow-md transition-shadow cursor-pointer ${onClick ? 'hover:border-primary' : ''}`}
    onClick={onClick}
  >
    <CardHeader>
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="text-base font-medium truncate flex-1">
          {task.id}
        </CardTitle>
        <Badge variant={getStatusBadgeVariant(task.taskStatus)}>
          {task.taskStatus}
        </Badge>
      </div>
      <CardDescription className="line-clamp-2">
        {task.taskInput}
      </CardDescription>
      {task.taskStatus === TaskStatus.IDLE && onStartTask && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            onClick={(e) => onStartTask(e, task.id)}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Task'}
          </Button>
        </div>
      )}
    </CardHeader>
  </Card>
);

const TaskListItem = ({ task, onClick, onStartTask, isStarting }: {
  task: TaskInfo;
  onClick?: () => void;
  onStartTask?: (e: React.MouseEvent, taskId: string) => Promise<void>;
  isStarting?: boolean;
}) => (
  <div
    className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer ${onClick ? 'hover:border-primary' : ''}`}
    onClick={onClick}
  >
    <div className={`w-2 h-2 rounded-full ${getStatusColor(task.taskStatus)}`} />
    <div className="flex-1 min-w-0">
      <div className="font-medium truncate">{task.id}</div>
      <div className="text-sm text-muted-foreground truncate">
        {task.taskInput}
      </div>
    </div>
    <Badge variant={getStatusBadgeVariant(task.taskStatus)}>
      {task.taskStatus}
    </Badge>
    {task.taskStatus === TaskStatus.IDLE && onStartTask && (
      <div onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          onClick={(e) => onStartTask(e, task.id)}
          disabled={isStarting}
        >
          {isStarting ? 'Starting...' : 'Start'}
        </Button>
      </div>
    )}
  </div>
);

export function TaskList({ tasks, loading, error, onTaskClick, onStartTask, startingTaskId }: TaskListProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('card');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">Error: {error.message}</div>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">No tasks found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
        >
          <ToggleGroupItem value="card" aria-label="Card view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
              onStartTask={onStartTask ? (e, taskId) => onStartTask(taskId) : undefined}
              isStarting={startingTaskId === task.id}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
              onStartTask={onStartTask ? (e, taskId) => onStartTask(taskId) : undefined}
              isStarting={startingTaskId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
