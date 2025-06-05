import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { leads, customers } from '../../db/schema.js';
import { IngestLeadSchema, UpdateLeadStatusSchema } from '../../types/api.js';
import type { IngestLeadInput, UpdateLeadStatusInput } from '../../types/api.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate, verifyTenant } from '../middleware/auth.js';

export async function leadRoutes(fastify: FastifyInstance) {
  
  // Ingest lead
  fastify.post('/ingest/:customerId', {
    preHandler: [authenticate, verifyTenant],
    schema: {
      body: IngestLeadSchema,
      params: {
        type: 'object',
        properties: {
          customerId: { type: 'string', format: 'uuid' }
        },
        required: ['customerId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const leadData = request.body as IngestLeadInput;
      
      // Verify customer exists
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      
      if (!customer) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Customer not found'
        });
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
      const [newLead] = await db
        .insert(leads)
        .values({
          customerId,
          externalId: leadData.externalId,
          source: leadData.source,
          customerName: leadData.customerName,
          customerEmail: leadData.customerEmail,
          customerPhone: leadData.customerPhone,
          message: leadData.message,
          metadata: leadData.metadata || {},
          rawData: leadData.rawData || {}
        })
        .returning();

      // TODO: Queue for AI processing
      // await queueLeadForProcessing(newLead.id);

      reply.status(201).send({
        success: true,
        data: newLead,
        message: 'Lead ingested successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to ingest lead'
      });
    }
  });

  // Get lead by ID
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);

      if (!lead) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Lead not found'
        });
        return;
      }

      reply.send({
        success: true,
        data: lead
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch lead'
      });
    }
  });

  // List leads for customer
  fastify.get('/customer/:customerId', {
    preHandler: [authenticate, verifyTenant],
    schema: {
      params: {
        type: 'object',
        properties: {
          customerId: { type: 'string', format: 'uuid' }
        },
        required: ['customerId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          status: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const { page = 1, limit = 20, status } = request.query as { page?: number; limit?: number; status?: string };
      
      // Verify customer exists
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      
      if (!customer) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      // Build query conditions
      const conditions = [eq(leads.customerId, customerId)];
      
      if (status) {
        conditions.push(eq(leads.status, status));
      }

      // Apply conditions and execute query
      const customerLeads = await db
        .select()
        .from(leads)
        .where(and(...conditions))
        .orderBy(leads.createdAt)
        .limit(limit)
        .offset((page - 1) * limit);

      // Get total count for pagination
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(and(...conditions));

      const total = Number(countResult?.count || 0);

      reply.send({
        success: true,
        data: customerLeads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch leads'
      });
    }
  });

  // Update lead status
  fastify.patch('/:id/status', {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: UpdateLeadStatusSchema
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as UpdateLeadStatusInput;

      const [updatedLead] = await db
        .update(leads)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(leads.id, id))
        .returning();

      if (!updatedLead) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Lead not found'
        });
        return;
      }

      reply.send({
        success: true,
        data: updatedLead
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update lead'
      });
    }
  });
}
