// Local ChatMessage interface for the client service
export interface ChatMessage {
  id: string;
  type: "user" | "ai" | "system" | "status";
  content: string;
  data?: any;
  timestamp: Date;
  sessionId: string;
}

export interface ChatSession {
  _id?: string;
  sessionId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  status: "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
}

export class ChatClientService {
  private static instance: ChatClientService;
  private currentSessionId: string | null = null;

  private constructor() {}

  static getInstance(): ChatClientService {
    if (!ChatClientService.instance) {
      ChatClientService.instance = new ChatClientService();
    }
    return ChatClientService.instance;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current session ID
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<string> {
    try {
      const response = await fetch("/api/chat/backend/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        // Try to get error details from the response
        let errorMessage = "Failed to create session";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorMessage = `Failed to create session: ${response.statusText} (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      this.currentSessionId = data.sessionId;
      return data.sessionId;
    } catch (error) {
      // Re-throw the error with more context if it's not already an Error object
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Failed to create session: ${error}`);
      }
    }
  }


  /**
   * Push a message to the current session
   */
  async pushMessage(type: string, content: string, data?: any): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("No active session");
    }

    const response = await fetch("/api/chat/backend/push-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: this.currentSessionId,
        type,
        content,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to push message");
    }
  }

  /**
   * Clear the current session
   */
  async clearSession(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      throw new Error("No session ID provided");
    }

    const response = await fetch("/api/chat/backend/clear-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: targetSessionId }),
    });

    if (!response.ok) {
      throw new Error("Failed to clear session");
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    console.log("ChatClientService: Deleting session", sessionId);
    const response = await fetch(`/api/chat/backend/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || "Failed to delete session";
      console.error(
        "ChatClientService: Failed to delete session",
        errorMessage,
      );
      throw new Error(errorMessage);
    }
    console.log("ChatClientService: Session deleted successfully", sessionId);
  }

  /**
   * Switch to a different session
   */
  async switchSession(sessionId: string): Promise<void> {
    this.currentSessionId = sessionId;
  }

  /**
   * Ensure we have an active session
   */
  async ensureSession(): Promise<string> {
    if (!this.currentSessionId) {
      return await this.createSession();
    }
    return this.currentSessionId;
  }
}

// Export singleton instance
export const chatClientService = ChatClientService.getInstance();
