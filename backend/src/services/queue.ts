import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL for host and port
const getRedisConnectionOptions = () => {
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return {
      host: 'localhost',
      port: 6379,
    };
  }
};

const connection = getRedisConnectionOptions();

// Export Queues
export const aiQueue = new Queue('ai-tasks', { connection });
export const notificationQueue = new Queue('notifications-queue', { connection });
export const exportQueue = new Queue('export-queue', { connection });
export const searchIndexQueue = new Queue('search-index-queue', { connection });

console.log('Successfully initialized BullMQ queues');
