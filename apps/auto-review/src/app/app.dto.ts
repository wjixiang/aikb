export class ReviewRequest {
    reviewTarget: string
    section?: 'epidemiology' | 'pathophysiology' | 'clinical' | 'treatment' | 'all'
}

export class ProgressRequest {
    reviewTarget: string
}

export interface ProgressResponse {
    taskId: string
    taskInput: string
    section?: string
    progress: Array<{
        id: string
        done: string
        log: string
        ts: Date
    }>
}
