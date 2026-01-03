import * as React from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { TaskStatus, Message, MessageRole } from 'MedAgent-service/graphql';
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
import { ArrowLeft, Clock, Terminal, Image as ImageIcon, CheckCircle } from 'lucide-react';
import Markdown from 'react-markdown';

// ==================== GraphQL Queries ====================
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
      text
      blocks {
        type
        text
        imageSource {
          type
          media_type
          data
        }
        toolUseId
        toolName
        toolInput
        toolResultId
        toolResultContent
      }
      ts
    }
  }
`;

// ==================== Type Definitions ====================
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
  getTaskMessages: Message[];
}

interface ImageSource {
  type: string;
  media_type?: string | null;
  data?: string | null;
}

interface MessageBlock {
  type: string;
  text?: string | null;
  imageSource?: ImageSource | null;
  toolUseId?: string | null;
  toolName?: string | null;
  toolInput?: string | object | null;
  toolResultId?: string | null;
  toolResultContent?: string | object | null;
}

// ==================== Utility Functions ====================
const getStatusBadgeVariant = (
  status: TaskStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variantMap: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    [TaskStatus.COMPLETED]: 'default',
    [TaskStatus.RUNNING]: 'secondary',
    [TaskStatus.ABORTED]: 'destructive',
    [TaskStatus.IDLE]: 'outline',
  };
  return variantMap[status] ?? 'outline';
};

const getRoleBadgeVariant = (role: MessageRole): 'default' | 'secondary' | 'outline' => {
  const variantMap: Record<MessageRole, 'default' | 'secondary' | 'outline'> = {
    [MessageRole.USER]: 'default',
    [MessageRole.ASSISTANT]: 'secondary',
    [MessageRole.SYSTEM]: 'outline',
  };
  return variantMap[role] ?? 'outline';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

const formatTimestamp = (ts: string | number): string => {
  return new Date(Number(ts)).toLocaleTimeString();
};

const stringifyInput = (input: string | object): string => {
  return typeof input === 'string' ? input : JSON.stringify(input, null, 2);
};

// ==================== Block Components ====================
const TextBlock = React.memo(({ text }: { text: string }) => (
  <div className="py-1">
    <p className="text-sm leading-relaxed">{text}</p>
  </div>
));
TextBlock.displayName = 'TextBlock';

const ToolUseBlock = React.memo(({ toolName, toolInput }: { toolName: string; toolInput: string | object }) => {
  const inputStr = stringifyInput(toolInput);
  const isAttemptCompletion = toolName === 'attempt_completion';

  return (
    <div className="my-2 rounded-lg border border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
      <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-2 dark:border-primary/20">
        {isAttemptCompletion ? (
          <CheckCircle className="h-4 w-4 text-primary" />
        ) : (
          <Terminal className="h-4 w-4 text-primary" />
        )}
        <span className="text-sm font-semibold text-primary">
          {isAttemptCompletion ? 'Task Complete' : `Tool: ${toolName}`}
        </span>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-xs text-foreground">
        {isAttemptCompletion ? (
          <Markdown>{JSON.parse(inputStr).result}</Markdown>
        ) : (
          inputStr
        )}
      </pre>
    </div>
  );
});
ToolUseBlock.displayName = 'ToolUseBlock';

const ToolResultBlock = React.memo(({ toolResultContent }: { toolResultContent: string | object }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const contentStr = stringifyInput(toolResultContent);
  console.log(toolResultContent)
  return (
    <div className="my-2 rounded-lg border border-secondary/20 bg-secondary/5 dark:border-secondary/30 dark:bg-secondary/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-2 border-b border-secondary/10 px-3 py-2 dark:border-secondary/20 hover:bg-secondary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            Tool Result
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <pre className="overflow-x-auto px-3 py-2 text-xs text-foreground">
          {contentStr}
        </pre>
      )}
    </div>
  );
});
ToolResultBlock.displayName = 'ToolResultBlock';

const ImageBlock = React.memo(({ imageSource }: { imageSource: ImageSource | null }) => {
  if (!imageSource) return null;

  return (
    <div className="my-2 rounded-lg border border-accent/20 bg-accent/5 dark:border-accent/30 dark:bg-accent/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-accent">
          Image: {imageSource.type}
        </span>
      </div>
      {imageSource.data && (
        <img
          src={`data:${imageSource.media_type || 'image/png'};base64,${imageSource.data}`}
          alt="Message image"
          className="max-h-64 rounded border"
        />
      )}
    </div>
  );
});
ImageBlock.displayName = 'ImageBlock';

const MessageBlocks = React.memo(({ blocks }: { blocks: MessageBlock[] }) => {
  return (
    <div className="space-y-1">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'text':
            return block.text && block.text.length > 0 ? (
              <TextBlock key={index} text={block.text} />
            ) : null;
          case 'tool_use':
            return block.toolName && block.toolInput ? (
              <ToolUseBlock key={index} toolName={block.toolName} toolInput={block.toolInput} />
            ) : null;
          case 'tool_result':
            return block.toolResultContent ? (
              <ToolResultBlock key={index} toolResultContent={block.toolResultContent} />
            ) : null;
          case 'image':
            return block.imageSource ? (
              <ImageBlock key={index} imageSource={block.imageSource} />
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
});
MessageBlocks.displayName = 'MessageBlocks';

// ==================== Message Components ====================
interface MessageItemProps {
  message: Message;
  index: number;
  totalMessages: number;
}

const MessageItem = React.memo(({ message, index, totalMessages }: MessageItemProps) => {
  const renderMessageContent = (): React.ReactNode => {
    if (message.text) {
      return <TextBlock text={message.text} />;
    }

    if (message.blocks && Array.isArray(message.blocks)) {
      return <MessageBlocks blocks={message.blocks} />;
    }

    return null;
  };

  return (
    <React.Fragment>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={getRoleBadgeVariant(message.role)}>
            {message.role}
          </Badge>
          {message.ts && (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.ts)}
            </span>
          )}
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          {renderMessageContent()}
        </div>
      </div>
      {index < totalMessages - 1 && <Separator />}
    </React.Fragment>
  );
});
MessageItem.displayName = 'MessageItem';

interface MessageListProps {
  messages: Message[];
}

const MessageList = React.memo(({ messages }: MessageListProps) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        No messages yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          index={index}
          totalMessages={messages.length}
        />
      ))}
    </div>
  );
});
MessageList.displayName = 'MessageList';

// ==================== Loading & Error States ====================
const LoadingState = () => (
  <div className="flex items-center justify-center p-8">
    <div className="text-muted-foreground">Loading task details...</div>
  </div>
);

const ErrorState = ({ error }: { error: Error | undefined }) => (
  <div className="flex items-center justify-center p-8">
    <div className="text-destructive">
      Error: {error?.message || 'Unknown error occurred'}
    </div>
  </div>
);

// ==================== Task Info Card ====================
interface TaskInfoCardProps {
  task: TaskInfoResponse['getTaskInfo'] | undefined;
}

const TaskInfoCard = React.memo(({ task }: TaskInfoCardProps) => (
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
      {task?.createdAt && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatDate(task.createdAt)}
        </div>
      )}
    </CardHeader>
  </Card>
));
TaskInfoCard.displayName = 'TaskInfoCard';

// ==================== Main Component ====================
export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const { data: taskData, loading: taskLoading, error: taskError } = useQuery<TaskInfoResponse>(
    GET_TASK_INFO,
    { variables: { taskId } }
  );

  const { data: messagesData, loading: messagesLoading, error: messagesError } = useQuery<TaskMessagesResponse>(
    GET_TASK_MESSAGES,
    { variables: { taskId } }
  );

  if (taskLoading || messagesLoading) {
    return <LoadingState />;
  }

  if (taskError || messagesError) {
    return <ErrorState error={taskError || messagesError} />;
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

      <TaskInfoCard task={task} />

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <MessageList messages={messages} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
