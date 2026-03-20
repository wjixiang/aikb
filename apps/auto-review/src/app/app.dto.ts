export class ReviewRequest {
    reviewTarget: string
}

export class ProgressRequest {
    reviewTarget: string
}

export interface ProgressResponse {
    taskId: string
    taskInput: string
    progress: Array<{
        id: string
        done: string
        log: string
        ts: Date
    }>
}