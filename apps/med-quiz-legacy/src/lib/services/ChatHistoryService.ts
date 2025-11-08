import { MongoClient, ObjectId } from 'mongodb';
import { clientPromise } from '@/lib/db/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'status';
  content: string;
  data?: any;
  timestamp: Date;
  sessionId: string;
}

export interface ChatSession {
  _id?: ObjectId;
  sessionId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
}

export class ChatHistoryService {
  private static instance: ChatHistoryService;

  private constructor() {}

  static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }

  private async getCollection() {
    const client = await clientPromise;
    const db = client.db(process.env.QUIZ_DB);
    return db.collection<ChatSession>('chat_sessions');
  }

  /**
   * Get the current authenticated user ID
   */
  private async getCurrentUserId(): Promise<string> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }
    return session.user.id;
  }

  /**
   * Create a new chat session for the current user
   */
  async createSession(title?: string): Promise<string> {
    try {
      const userId = await this.getCurrentUserId();
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const collection = await this.getCollection();

      const newSession: Omit<ChatSession, '_id'> = {
        sessionId,
        userId,
        title: title || '新对话',
        messages: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
      };

      await collection.insertOne(newSession as ChatSession);

      return sessionId;
    } catch (error) {
      console.error('Error creating session in ChatHistoryService:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to create session: ${error.message}`);
      } else {
        throw new Error('Failed to create session: Unknown error');
      }
    }
  }

  /**
   * Get all chat sessions for the current user
   */
  async getUserSessions(): Promise<ChatSession[]> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const sessions = await collection
      .find({ userId })
      .sort({ lastActivity: -1 })
      .toArray();

    return sessions;
  }

  /**
   * Get a specific chat session for the current user
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const session = await collection.findOne({ sessionId, userId });
    return session;
  }

  /**
   * Add a message to a chat session
   */
  async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'sessionId' | 'timestamp'>,
  ): Promise<void> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const fullMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: new Date(),
    };

    const result = await collection.updateOne(
      { sessionId, userId },
      {
        $push: { messages: fullMessage },
        $set: {
          updatedAt: new Date(),
          lastActivity: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error('Session not found or access denied');
    }
  }

  /**
   * Get messages for a specific session
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const session = await collection.findOne(
      { sessionId, userId },
      { projection: { messages: 1 } },
    );

    return session?.messages || [];
  }

  /**
   * Update session title
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { sessionId, userId },
      {
        $set: {
          title,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error('Session not found or access denied');
    }
  }

  /**
   * Clear a session (delete all messages)
   */
  async clearSession(sessionId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { sessionId, userId },
      {
        $set: {
          messages: [],
          updatedAt: new Date(),
          lastActivity: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error('Session not found or access denied');
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    console.log('ChatHistoryService: Deleting session', sessionId);
    const userId = await this.getCurrentUserId();
    console.log('ChatHistoryService: User ID', userId);
    const collection = await this.getCollection();

    const result = await collection.deleteOne({ sessionId, userId });
    console.log('ChatHistoryService: Delete result', result);

    if (result.deletedCount === 0) {
      console.error(
        'ChatHistoryService: Session not found or access denied',
        sessionId,
      );
      throw new Error('Session not found or access denied');
    }
    console.log('ChatHistoryService: Session deleted successfully', sessionId);
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const result = await collection.updateOne(
      { sessionId, userId },
      {
        $set: {
          status: 'archived',
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      throw new Error('Session not found or access denied');
    }
  }

  /**
   * Get recent sessions with message count
   */
  async getRecentSessions(limit: number = 10): Promise<ChatSession[]> {
    const userId = await this.getCurrentUserId();
    const collection = await this.getCollection();

    const sessions = await collection
      .find({ userId, status: { $ne: 'archived' } })
      .sort({ lastActivity: -1 })
      .limit(limit)
      .toArray();

    return sessions;
  }
}

// Export singleton instance
export const chatHistoryService = ChatHistoryService.getInstance();
