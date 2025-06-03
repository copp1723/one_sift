import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from '../config/index.js';
import { setupRateLimiting, applyRateLimit, rateLimiters } from './middleware/rate-limit.js';

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
  fastify.get('/health', async (request, reply) => {
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

  // Global error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    fastify.log.error(error);

    // Validation errors
    if (error.validation) {
      reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.validation
      });
      return;
    }

    // Rate limiting errors
    if (error.statusCode === 429) {
      reply.status(429).send({
        error: 'Too Many Requests',
        message: error.message
      });
      return;
    }

    // Default error response
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.name,
      message: statusCode >= 500 ? 'Something went wrong' : error.message
    });
  });

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`
    });
  });

  return fastify;
}

export async function startServer(): Promise<void> {
  try {
    const server = await createServer();
    
    await server.listen({ 
      port: env.PORT, 
      host: '0.0.0.0' 
    });
    
    console.log(`🚀 Server running on port ${env.PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
