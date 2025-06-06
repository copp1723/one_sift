import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { leads, customers } from '../../db/schema.js';
import { ingestLeadSchema } from '../../types/schemas.js';
import type { IngestLeadInput } from '../../types/schemas.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken, authenticateToken as verifyTenant } from '../middleware/auth.js';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendInternalError,
  sendPaginated,
  calculatePagination
} from '../../utils/response.js';
import {
  findById,
  createWithConflictCheck,
  updateById,
  findPaginated
} from '../../utils/database.js';

export async function leadRoutes(fastify: FastifyInstance) {
  
  // Ingest lead
  fastify.post('/ingest/:customerId', {
    preHandler: [authenticateToken, verifyTenant],
    schema: {
      body: ingestLeadSchema
    }
  }, async (request, reply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const leadData = request.body as IngestLeadInput;

      // Verify customer exists and is active
      const customer = await findById<{ id: string; isActive: boolean }>(customers, customerId);
      if (!customer) {
        sendNotFound(reply, 'Customer', request.id);
        return;
      }

      if (!customer.isActive) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Customer account is inactive'
        });
        return;
      }

      // Create lead
      const result = await createWithConflictCheck(leads, {
        customerId,
        externalId: leadData.externalId,
        source: leadData.source,
        customerName: leadData.customerName,
        customerEmail: leadData.customerEmail,
        customerPhone: leadData.customerPhone,
        metadata: leadData.metadata || {},
        rawData: leadData.rawData || {}
      });

      if (!result.success) {
        sendInternalError(reply, 'Failed to ingest lead', request.id, new Error(result.error!));
        return;
      }

      // TODO: Queue for AI processing
      // await queueLeadForProcessing(result.data!.id);

      sendCreated(reply, result.data!, 'Lead ingested successfully');
    } catch (error) {
      sendInternalError(reply, 'Failed to ingest lead', request.id, error as Error);
    }
  });

  // Get lead by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const lead = await findById(leads, id);
      if (!lead) {
        sendNotFound(reply, 'Lead', request.id);
        return;
      }

      sendSuccess(reply, lead);
    } catch (error) {
      sendInternalError(reply, 'Failed to fetch lead', request.id, error as Error);
    }
  });

  // List leads for customer
  fastify.get<{
    Params: { customerId: string };
    Querystring: { page?: number; limit?: number; status?: string }
  }>('/customer/:customerId', {
    preHandler: [authenticateToken, verifyTenant]
  }, async (request, reply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const { page = 1, limit = 20, status } = request.query as { page?: number; limit?: number; status?: string };

      // Verify customer exists
      const customer = await findById(customers, customerId);
      if (!customer) {
        sendNotFound(reply, 'Customer', request.id);
        return;
      }

      // Build query conditions
      const conditions = [eq(leads.customerId, customerId)];
      if (status) {
        conditions.push(eq(leads.status, status as any));
      }

      const customerLeads = await findPaginated(
        leads,
        page,
        limit,
        and(...conditions),
        leads.createdAt
      );

      const pagination = calculatePagination(page, limit, customerLeads.length);
      sendPaginated(reply, customerLeads, pagination);
    } catch (error) {
      sendInternalError(reply, 'Failed to fetch leads', request.id, error as Error);
    }
  });

  // Update lead status
  fastify.patch<{
    Params: { id: string };
    Body: { status: string }
  }>('/:id/status', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const result = await updateById(leads, id, {
        status: status as any
      });

      if (!result.success) {
        sendNotFound(reply, 'Lead', request.id);
        return;
      }

      sendSuccess(reply, result.data!);
    } catch (error) {
      sendInternalError(reply, 'Failed to update lead', request.id, error as Error);
    }
  });
}
