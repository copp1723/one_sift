import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from '../../config/index.js';
import { redis } from '../../config/redis.js';

// Define rate limiters for different routes
export const rateLimiters = {
  global: {
    max: 1000,
    timeWindow: '1 minute'
  },
  customerCreation: {
    max: 10,
    timeWindow: '1 minute'
  },
  leadIngestion: {
    max: 100,
    timeWindow: '1 minute'
  },
  webhooks: {
    max: 200,
    timeWindow: '1 minute'
  },
  conversation: {
    max: 50,
    timeWindow: '1 minute'
  }
};

// Setup global rate limiting
export async function setupRateLimiting(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: rateLimiters.global.max,
    timeWindow: rateLimiters.global.timeWindow,
    redis: redis,
    nameSpace: 'one-sift-rate-limit:',
    skipOnError: config.NODE_ENV !== 'production',
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      limit: context.max,
      remaining: context.remaining,
      reset: context.reset
    })
  });
}

// Apply specific rate limits to routes
export function applyRateLimit(
  fastify: FastifyInstance,
  route: string,
  options: { max: number; timeWindow: string }
): void {
  fastify.register(fastifyRateLimit, {
    global: false,
    max: options.max,
    timeWindow: options.timeWindow,
    redis: redis,
    nameSpace: `one-sift-rate-limit:${route}:`,
    skipOnError: config.NODE_ENV !== 'production',
    routePrefix: route
  });
}
