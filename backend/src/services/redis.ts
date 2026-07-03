import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Successfully connected to Redis');
  } catch (error) {
    console.error('Error connecting to Redis:', error);
    process.exit(1);
  }
};

// Presence Helper functions
export const updateCursorPresence = async (
  documentId: string,
  userId: string,
  userName: string,
  cursor: { line: number; ch: number } | null,
  selection: { anchor: number; head: number } | null
) => {
  const presenceKey = `presence:${documentId}`;
  const value = JSON.stringify({
    userId,
    userName,
    cursor,
    selection,
    lastActive: Date.now(),
  });
  await redisClient.hSet(presenceKey, userId, value);
  // Set expiry on presence key so it doesn't leak memory if clients disconnect abruptly
  await redisClient.expire(presenceKey, 300); // 5 minutes TTL
};

export const updateTypingPresence = async (
  documentId: string,
  userId: string,
  isTyping: boolean
) => {
  const typingKey = `typing:${documentId}`;
  if (isTyping) {
    await redisClient.sAdd(typingKey, userId);
    await redisClient.expire(typingKey, 60); // 1 minute TTL
  } else {
    await redisClient.sRem(typingKey, userId);
  }
};

export const getDocumentPresence = async (documentId: string) => {
  const presenceKey = `presence:${documentId}`;
  const typingKey = `typing:${documentId}`;

  const presenceData = await redisClient.hGetAll(presenceKey);
  const typingUsers = await redisClient.sMembers(typingKey);

  const activeUsers: any[] = [];
  const now = Date.now();

  for (const [userId, userString] of Object.entries(presenceData)) {
    try {
      const data = JSON.parse(userString);
      // Clean up idle users (idle for > 30 seconds)
      if (now - data.lastActive > 30000) {
        await redisClient.hDel(presenceKey, userId);
        continue;
      }
      activeUsers.push({
        ...data,
        isTyping: typingUsers.includes(userId),
      });
    } catch {
      await redisClient.hDel(presenceKey, userId);
    }
  }

  return activeUsers;
};

export const removePresence = async (documentId: string, userId: string) => {
  await redisClient.hDel(`presence:${documentId}`, userId);
  await redisClient.sRem(`typing:${documentId}`, userId);
};
