import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/index.js';
import { verifyJwt } from '../../utils/jwt.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const auth = request.headers['authorization'];
    if (!auth) throw new Error('Missing token');
    const token = auth.split(' ')[1];
    const payload = verifyJwt<{ tenantId: string }>(token, config.API_KEY_SECRET);
    (request as any).user = payload;
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function verifyTenant(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request as any).user?.tenantId;
  const paramTenant = (request.params as any)?.customerId;
  if (tenantId && paramTenant && tenantId !== paramTenant) {
    reply.status(403).send({ error: 'Forbidden' });
  }
}
