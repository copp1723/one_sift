import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      tenantId: string;
      email?: string;
    };
  }
}

// Export common Fastify types for consistent usage
export type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyError,
  RouteOptions,
  RequestGenericInterface
} from 'fastify';
