import type {
    ApiMessage,
    TaskStatus,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
} from '../task.type';

/**
 * Manages observer pattern for Task events
 * Handles registration, unregistration, and notification of callbacks
 */
export class TaskObservers {
    private messageAddedCallbacks: MessageAddedCallback[] = [];
    private taskStatusChangedCallbacks: TaskStatusChangedCallback[] = [];
    private taskCompletedCallbacks: TaskCompletedCallback[] = [];

    /**
     * Register message added observer
     * @param callback - Function to be called when a message is added
     * @returns cleanup function - Used to unregister
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        this.messageAddedCallbacks.push(callback);

        return () => {
            this.messageAddedCallbacks = this.messageAddedCallbacks.filter(
                (cb) => cb !== callback,
            );
        };
    }

    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        this.taskStatusChangedCallbacks.push(callback);

        return () => {
            this.taskStatusChangedCallbacks = this.taskStatusChangedCallbacks.filter(
                (cb) => cb !== callback,
            );
        };
    }

    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        this.taskCompletedCallbacks.push(callback);

        return () => { };
    }

    /**
     * Notify all observers of message addition
     */
    notifyMessageAdded(taskId: string, message: ApiMessage): void {
        this.messageAddedCallbacks.forEach((callback) => {
            try {
                callback(taskId, message);
            } catch (error) {
                console.error('Error in callback:', error);
            }
        });
    }

    /**
     * Notify all observers of status change
     */
    notifyStatusChanged(taskId: string, status: TaskStatus): void {
        this.taskStatusChangedCallbacks.forEach((callback) => {
            try {
                callback(taskId, status);
            } catch (error) {
                console.error('Error in callback:', error);
            }
        });
    }

    /**
     * Notify all observers of task completion
     */
    notifyTaskCompleted(taskId: string): void {
        this.taskCompletedCallbacks.forEach((callback) => {
            try {
                callback(taskId);
            } catch (error) {
                console.error('Error in callback:', error);
            }
        });
    }
}
