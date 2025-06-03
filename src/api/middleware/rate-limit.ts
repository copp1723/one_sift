import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../config/redis.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const windowStart = Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs;
    const redisKey = `rate_limit:${key}:${windowStart}`;
    
    try {
      const current = await redis.incr(redisKey);
      
      if (current === 1) {
        // Set expiration for the window
        await redis.expire(redisKey, Math.ceil(this.config.windowMs / 1000));
      }
      
      const allowed = current <= this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - current);
      const resetTime = windowStart + this.config.windowMs;
      
      return { allowed, remaining, resetTime };
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: this.config.maxRequests, resetTime: Date.now() + this.config.windowMs };
    }
  }

  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const key = this.config.keyGenerator 
        ? this.config.keyGenerator(request)
        : request.ip;
      
      const result = await this.isAllowed(key);
      
      // Add rate limit headers
      reply.header('X-RateLimit-Limit', this.config.maxRequests);
      reply.header('X-RateLimit-Remaining', result.remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      
      if (!result.allowed) {
        reply.status(429).send({
          error: 'Too Many Requests',
          message: this.config.message || 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
        return;
      }
    };
  }
}

// Predefined rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limiting
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Too many requests from this IP'
  }),

  // Customer creation (more restrictive)
  customerCreation: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req) => req.ip,
    message: 'Too many customer creation attempts'
  }),

  // Lead ingestion (per customer)
  leadIngestion: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => {
      const customerId = (req.params as any)?.customerId || 'unknown';
      return `customer:${customerId}`;
    },
    message: 'Lead ingestion rate limit exceeded'
  }),

  // Webhook endpoints
  webhooks: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyGenerator: (req) => req.ip,
    message: 'Webhook rate limit exceeded'
  }),

  // AI conversation endpoints
  conversation: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    keyGenerator: (req) => {
      const customerId = (req.params as any)?.customerId || req.ip;
      return `conversation:${customerId}`;
    },
    message: 'Conversation rate limit exceeded'
  })
};

// Setup function for global rate limiting
export async function setupRateLimiting(fastify: FastifyInstance) {
  // Register global rate limiting plugin
  await fastify.register(import('@fastify/rate-limit'), {
    max: 1000,
    timeWindow: '15 minutes',
    redis: redis,
    skipOnError: true, // Don't fail if Redis is down
    keyGenerator: (req) => req.ip
  });
}

// Helper function to apply rate limiting to specific routes
export function applyRateLimit(
  fastify: FastifyInstance, 
  route: string, 
  rateLimiter: RateLimiter
) {
  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply to matching routes
    if (request.url.startsWith(route)) {
      await rateLimiter.createMiddleware()(request, reply);
    }
  });
}
