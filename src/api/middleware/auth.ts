import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';
import { verifyJwt } from '../../utils/jwt.js';

export async function authenticateToken(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers['authorization'];
  if (!auth) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Access token required' });
    return;
  }

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token format' });
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyJwt<any>(token, config.API_KEY_SECRET);
    (request as any).user = payload;

    const tenantParam = (request.params as any)?.customerId;
    if (tenantParam && payload?.tenantId && tenantParam !== payload.tenantId) {
      reply.status(403).send({ error: 'Forbidden', message: 'Access denied for this resource' });
      return;
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
