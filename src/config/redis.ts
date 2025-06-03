import Redis from 'ioredis';
import { config } from './index.js';

// Main Redis connection for caching
export const redis = new Redis(config.REDIS_URL, {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// Worker Redis connection (separate for BullMQ)
export const workerRedis = new Redis(config.REDIS_URL, {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnections(): Promise<void> {
  await Promise.all([
    redis.disconnect(),
    workerRedis.disconnect()
  ]);
}

// Redis event handlers
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

workerRedis.on('connect', () => {
  console.log('Worker Redis connected');
});

workerRedis.on('error', (error) => {
  console.error('Worker Redis connection error:', error);
});
