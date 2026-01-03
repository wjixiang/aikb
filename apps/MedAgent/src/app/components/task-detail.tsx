import * as React from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { TaskStatus, ApiMessage, MessageRole } from 'MedAgent-service/graphql';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock } from 'lucide-react';

interface TaskDetailProps {
  taskId: string;
  onBack?: () => void;
}

interface TaskInfoResponse {
  getTaskInfo: {
    id: string;
    taskInput: string;
    taskStatus: TaskStatus;
    createdAt: string;
  };
}

interface TaskMessagesResponse {
  getTaskMessages: ApiMessage[];
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const GET_TASK_INFO = gql`
    query GetTaskInfo($taskId: ID!) {
      getTaskInfo(taskId: $taskId) {
        id
        taskInput
        taskStatus
        createdAt
      }
    }
  `;

  const GET_TASK_MESSAGES = gql`
    query GetTaskMessages($taskId: ID!) {
      getTaskMessages(taskId: $taskId) {
        role
        content {
          ... on StringContent {
            text
          }
          ... on BlocksContent {
            blocks {
              ... on Block {
                type
              }
              ... on TextBlock {
                text
              }
              ... on ImageBlock {
                source {
                  type
                  media_type
                  data
                }
              }
              ... on ToolUseBlock {
                id
                name
                input
              }
              ... on ToolResultBlock {
                tool_use_id
                content
              }
            }
          }
        }
        ts
      }
    }
  `;

  const { data: taskData, loading: taskLoading, error: taskError } = useQuery<TaskInfoResponse>(
    GET_TASK_INFO,
    { variables: { taskId } }
  );

  const { data: messagesData, loading: messagesLoading, error: messagesError } = useQuery<TaskMessagesResponse>(
    GET_TASK_MESSAGES,
    { variables: { taskId } }
  );

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

  const formatMessageContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (content && typeof content === 'object') {
      if ('text' in content) {
        return content.text;
      }
      if ('blocks' in content && Array.isArray(content.blocks)) {
        return content.blocks
          .map((block: any) => {
            if (block.type === 'text' && block.text) {
              return block.text;
            }
            if (block.type === 'tool_use' && block.name) {
              return `[Tool: ${block.name}]`;
            }
            if (block.type === 'tool_result' && block.content) {
              return `[Tool Result: ${block.content}]`;
            }
            return JSON.stringify(block);
          })
          .join('\n');
      }
    }
    return JSON.stringify(content);
  };

  const getRoleBadgeVariant = (role: MessageRole): 'default' | 'secondary' | 'outline' => {
    switch (role) {
      case MessageRole.USER:
        return 'default';
      case MessageRole.ASSISTANT:
        return 'secondary';
      case MessageRole.SYSTEM:
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (taskLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading task details...</div>
      </div>
    );
  }

  if (taskError || messagesError) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-destructive">
          Error: {(taskError || messagesError)?.message}
        </div>
      </div>
    );
  }

  const task = taskData?.getTaskInfo;
  const messages = messagesData?.getTaskMessages || [];

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <CardTitle className="text-xl">{task?.id}</CardTitle>
              <CardDescription className="text-base">
                {task?.taskInput}
              </CardDescription>
            </div>
            <Badge variant={getStatusBadgeVariant(task?.taskStatus || TaskStatus.IDLE)}>
              {task?.taskStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {task?.createdAt && formatDate(task.createdAt)}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No messages yet
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <React.Fragment key={index}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(message.role)}>
                          {message.role}
                        </Badge>
                        {message.ts && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.ts).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <pre className="whitespace-pre-wrap wrap-break-word text-sm">
                          {formatMessageContent(message.content)}
                        </pre>
                      </div>
                    </div>
                    {index < messages.length - 1 && <Separator />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
