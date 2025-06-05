import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';
import { verifyJwt } from '../../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('auth-middleware');

export async function authenticateToken(request: FastifyRequest, _reply: FastifyReply) {
  const auth = request.headers['authorization'];
  
  if (!auth) {
    logger.debug('No authorization header provided', { 
      requestId: request.id,
      path: request.url 
    });
    throw new UnauthorizedError('Access token required');
  }

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.debug('Invalid token format', { 
      requestId: request.id,
      format: parts[0] 
    });
    throw new UnauthorizedError('Invalid token format. Expected: Bearer <token>');
  }

  const token = parts[1];

  try {
    const payload = verifyJwt<{ tenantId?: string; userId?: string; exp?: number }>(
      token, 
      config.API_KEY_SECRET
    );
    
    // Add user context to request
    (request as any).user = payload;
    
    // Verify tenant access if customerId is in params
    const tenantParam = (request.params as any)?.customerId;
    if (tenantParam && payload?.tenantId && tenantParam !== payload.tenantId) {
      logger.warn('Tenant access violation attempted', {
        requestId: request.id,
        requestedTenant: tenantParam,
        userTenant: payload.tenantId,
        userId: payload.userId
      });
      throw new ForbiddenError('Access denied for this resource', 'tenant_mismatch');
    }
    
    logger.debug('Authentication successful', {
      requestId: request.id,
      userId: payload.userId,
      tenantId: payload.tenantId
    });
    
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      throw error;
    }
    
    logger.debug('Token verification failed', {
      requestId: request.id,
      error: error instanceof Error ? error : new Error(String(error))
    });
    
    // Check for specific JWT errors
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw new UnauthorizedError('Token has expired');
      }
      if (error.message.includes('invalid')) {
        throw new UnauthorizedError('Invalid token signature');
      }
    }
    
    throw new UnauthorizedError('Invalid or expired token');
  }
}
