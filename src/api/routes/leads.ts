import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { leads, customers } from '../../db/schema.js';
import { ingestLeadSchema } from '../../types/schemas.js';
import type { IngestLeadInput } from '../../types/schemas.js';
import { eq } from 'drizzle-orm';
import { authenticateToken, authenticateToken as verifyTenant } from '../middleware/auth.js';

export async function leadRoutes(fastify: FastifyInstance) {
  
  // Ingest lead
  fastify.post('/ingest/:customerId', {
    preHandler: [authenticateToken, verifyTenant],
    schema: {
      body: ingestLeadSchema
    }
  }, async (request: FastifyRequest<{
    Params: { customerId: string };
    Body: IngestLeadInput
  }>, reply: FastifyReply) => {
    try {
      const { customerId } = request.params;
      const leadData = request.body;
      
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
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
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
    preHandler: [authenticateToken, verifyTenant]
  }, async (request: FastifyRequest<{
    Params: { customerId: string };
    Querystring: { page?: number; limit?: number; status?: string }
  }>, reply: FastifyReply) => {
    try {
      const { customerId } = request.params;
      const { page = 1, limit = 20, status } = request.query;
      
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

      // Build query
      let query = db
        .select()
        .from(leads)
        .where(eq(leads.customerId, customerId));

      if (status) {
        query = query.where(eq(leads.status, status as any));
      }

      const customerLeads = await query
        .orderBy(leads.createdAt)
        .limit(limit)
        .offset((page - 1) * limit);

      reply.send({
        success: true,
        data: customerLeads,
        pagination: {
          page,
          limit,
          total: customerLeads.length // TODO: Get actual count
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
    preHandler: authenticateToken
  }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: { status: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      const [updatedLead] = await db
        .update(leads)
        .set({
          status: status as any,
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
