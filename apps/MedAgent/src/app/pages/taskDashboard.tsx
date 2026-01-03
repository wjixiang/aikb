import * as React from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { TaskList, TaskInfo } from '../components/task-list';
import { TaskDetail } from '../components/task-detail';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface TaskDashboardProps {}

export function TaskDashboard(props: TaskDashboardProps) {
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [taskInput, setTaskInput] = React.useState('');
  const [startingTaskId, setStartingTaskId] = React.useState<string | null>(null);

  const LIST_TASKS = gql`
    {
      listTaskInfo {
        id
        taskStatus
        taskInput
      }
    }
  `;

  const CREATE_TASK = gql`
    mutation CreateTask($input: CreateTaskInput!) {
      createTask(input: $input) {
        id
        taskStatus
        taskInput
      }
    }
  `;

  const START_TASK = gql`
    mutation StartTask($input: StartTaskInput!) {
      startTask(input: $input) {
        isSuccess
        failedReason
      }
    }
  `;

  const { loading, error, data, refetch } = useQuery<{
    listTaskInfo: TaskInfo[]
  }>(LIST_TASKS);

  const [createTask, { loading: creating }] = useMutation<
    { createTask: TaskInfo },
    { input: { taskInput: string } }
  >(CREATE_TASK, {
    onCompleted: (data) => {
      refetch();
      setIsCreateDialogOpen(false);
      setTaskInput('');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
    },
  });

  const [startTask] = useMutation<
    { startTask: { isSuccess: boolean; failedReason?: string | null } },
    { input: { taskId: string } }
  >(START_TASK, {
    onCompleted: (data) => {
      if (data.startTask.isSuccess) {
        refetch();
      } else {
        console.error('Failed to start task:', data.startTask.failedReason);
      }
      setStartingTaskId(null);
    },
    onError: (error) => {
      console.error('Error starting task:', error);
      setStartingTaskId(null);
    },
  });

  const handleStartTask = async (taskId: string) => {
    setStartingTaskId(taskId);
    await startTask({
      variables: {
        input: { taskId },
      },
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;

    await createTask({
      variables: {
        input: {
          taskInput: taskInput.trim(),
        },
      },
    });
  };

  if (selectedTaskId) {
    return (
      <TaskDetail
        taskId={selectedTaskId}
        onBack={() => setSelectedTaskId(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateTask}>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Enter the task description to create a new task.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="taskInput">Task Description</Label>
                  <Input
                    id="taskInput"
                    placeholder="Enter task description..."
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    disabled={creating}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !taskInput.trim()}>
                  {creating ? 'Creating...' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <TaskList
        tasks={data?.listTaskInfo || []}
        loading={loading}
        error={error}
        onTaskClick={setSelectedTaskId}
        onStartTask={handleStartTask}
        startingTaskId={startingTaskId || undefined}
      />
    </div>
  );
}
