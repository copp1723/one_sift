import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from '../config/index.js';

import { setupRateLimiting, applyRateLimit, rateLimiters } from './middleware/rate-limit.js';
import { registerErrorHandlers } from './middleware/error-handler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('server');

export async function createServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL
    }
  });

  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false // Disable CSP for API
  });

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? config.ALLOWED_ORIGINS
      : true,
    credentials: true
  });

  // Setup global rate limiting
  await setupRateLimiting(fastify);

  // Apply specific rate limits to routes
  applyRateLimit(fastify, '/api/v1/customers', rateLimiters.customerCreation);
  applyRateLimit(fastify, '/api/v1/leads/ingest', rateLimiters.leadIngestion);
  applyRateLimit(fastify, '/webhooks', rateLimiters.webhooks);
  applyRateLimit(fastify, '/api/v1/conversations', rateLimiters.conversation);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };
  });

  // API routes
  const { customerRoutes } = await import('./routes/customers.js');
  const { leadRoutes } = await import('./routes/leads.js');

  await fastify.register(customerRoutes, { prefix: '/api/v1/customers' });
  await fastify.register(leadRoutes, { prefix: '/api/v1/leads' });
  // TODO: Register webhook routes
  // await fastify.register(webhookRoutes, { prefix: '/webhooks' });

  // Register comprehensive error handlers
  registerErrorHandlers(fastify);

  logger.info('Server initialized with error handlers');

  return fastify;
}

export async function startServer(): Promise<void> {
  try {
    const server = await createServer();
    
    await server.listen({ 
      port: config.PORT, 
      host: '0.0.0.0' 
    });
    
    logger.info(`Server running on port ${config.PORT}`, {
      environment: config.NODE_ENV,
      port: config.PORT
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error : new Error(String(error)) });
    process.exit(1);
  }
}
