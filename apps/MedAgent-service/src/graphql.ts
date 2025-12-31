
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum TaskStatus {
    IDLE = "IDLE",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    ABORTED = "ABORTED"
}

export enum MessageRole {
    USER = "USER",
    ASSISTANT = "ASSISTANT",
    SYSTEM = "SYSTEM"
}

export class CreateTaskInput {
    userId: string;
    taskInput: string;
}

export class BlockInput {
    type: string;
}

export class TextBlockInput {
    type: string;
    text: string;
}

export class ImageSourceInput {
    type: string;
    media_type: string;
    data: string;
}

export class ImageBlockInput {
    type: string;
    source: ImageSourceInput;
}

export class ToolUseBlockInput {
    type: string;
    id: string;
    name: string;
    input: string;
}

export class ToolResultBlockInput {
    type: string;
    tool_use_id: string;
    content?: Nullable<string>;
}

export class MessageBlockInput {
    type: string;
    text?: Nullable<string>;
    source?: Nullable<ImageSourceInput>;
    id?: Nullable<string>;
    name?: Nullable<string>;
    input?: Nullable<string>;
    tool_use_id?: Nullable<string>;
    content?: Nullable<string>;
}

export interface Block {
    type: string;
}

export abstract class IQuery {
    abstract listTaskInfo(): TaskInfo[] | Promise<TaskInfo[]>;

    abstract getTaskInfo(taskId: string): TaskInfo | Promise<TaskInfo>;

    abstract getTaskMessages(taskId: string): ApiMessage[] | Promise<ApiMessage[]>;
}

export abstract class IMutation {
    abstract createTask(input: CreateTaskInput): TaskInfo | Promise<TaskInfo>;
}

export class TaskInfo {
    id: string;
    taskInput: string;
    taskStatus: TaskStatus;
    createdAt: string;
}

export class TextBlock implements Block {
    type: string;
    text: string;
}

export class ImageSource {
    type: string;
    media_type: string;
    data: string;
}

export class ImageBlock implements Block {
    type: string;
    source: ImageSource;
}

export class ToolUseBlock implements Block {
    type: string;
    id: string;
    name: string;
    input: string;
}

export class ToolResultBlock implements Block {
    type: string;
    tool_use_id: string;
    content?: Nullable<string>;
}

export class StringContent {
    text: string;
}

export class BlocksContent {
    blocks: ContentBlock[];
}

export class ApiMessage {
    role: MessageRole;
    content: MessageContent;
    ts?: Nullable<number>;
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;
export type MessageContent = StringContent | BlocksContent;
type Nullable<T> = T | null;
