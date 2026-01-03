import * as React from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { TaskList, TaskInfo } from '../components/task-list';
import { TaskDetail } from '../components/task-detail';

interface TaskDashboardProps {}

export function TaskDashboard(props: TaskDashboardProps) {
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const LIST_TASKS = gql`
    {
      listTaskInfo {
        id
        taskStatus
        taskInput
      }
    }
  `;

  const { loading, error, data } = useQuery<{
    listTaskInfo: TaskInfo[]
  }>(LIST_TASKS);

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
      <TaskList
        tasks={data?.listTaskInfo || []}
        loading={loading}
        error={error}
        onTaskClick={setSelectedTaskId}
      />
    </div>
  );
}
