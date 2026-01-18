
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
    taskInput: string;
}

export class StartTaskInput {
    taskId: string;
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

export class TaskWhereInput {
    id?: Nullable<string>;
    id_in?: Nullable<string[]>;
    userId?: Nullable<string>;
    userId_in?: Nullable<string[]>;
    status?: Nullable<TaskStatus>;
    status_in?: Nullable<TaskStatus[]>;
    createdAt_gt?: Nullable<string>;
    createdAt_lt?: Nullable<string>;
    createdAt_gte?: Nullable<string>;
    createdAt_lte?: Nullable<string>;
    taskInput_contains?: Nullable<string>;
    taskInput_starts_with?: Nullable<string>;
    AND?: Nullable<TaskWhereInput[]>;
    OR?: Nullable<TaskWhereInput[]>;
    NOT?: Nullable<TaskWhereInput[]>;
}

export abstract class IQuery {
    abstract task(where?: Nullable<TaskWhereInput>): Nullable<TaskInfo> | Promise<Nullable<TaskInfo>>;

    abstract tasks(where?: Nullable<TaskWhereInput>): Nullable<TaskInfo>[] | Promise<Nullable<TaskInfo>[]>;
}

export abstract class IMutation {
    abstract createTask(input: CreateTaskInput): TaskInfo | Promise<TaskInfo>;

    abstract startTask(input: StartTaskInput): StartTaskResult | Promise<StartTaskResult>;
}

export class TaskInfo {
    id: string;
    taskInput: string;
    taskStatus: TaskStatus;
    createdAt: string;
}

export class StartTaskResult {
    isSuccess: boolean;
    failedReason?: Nullable<string>;
}

export class Message {
    role: MessageRole;
    text?: Nullable<string>;
    blocks?: Nullable<MessageBlock[]>;
    ts?: Nullable<string>;
}

export class MessageBlock {
    type: string;
    text?: Nullable<string>;
    imageSource?: Nullable<ImageSource>;
    toolUseId?: Nullable<string>;
    toolName?: Nullable<string>;
    toolInput?: Nullable<string>;
    toolResultId?: Nullable<string>;
    toolResultContent?: Nullable<string>;
}

export class ImageSource {
    type: string;
    media_type: string;
    data: string;
}

type Nullable<T> = T | null;
