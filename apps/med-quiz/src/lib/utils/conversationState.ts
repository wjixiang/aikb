import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

interface ConversationState {
  messages: any[];
  question: string;
  source: string;
}

export async function getConversationState(
  userId: string,
): Promise<ConversationState | null> {
  if (!redis.status.includes("ready")) {
    return null;
  }
  const state = await redis.get(`conversation:${userId}`);
  return state ? JSON.parse(state) : null;
}

export async function saveConversationState(
  userId: string,
  state: ConversationState,
): Promise<void> {
  if (!redis.status.includes("ready")) {
    return;
  }
  await redis.set(`conversation:${userId}`, JSON.stringify(state), "EX", 3600); // 1小时过期
}

export async function clearConversationState(userId: string): Promise<void> {
  if (!redis.status.includes("ready")) {
    return;
  }
  await redis.del(`conversation:${userId}`);
}
