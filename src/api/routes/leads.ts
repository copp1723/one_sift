import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { leads, customers } from '../../db/schema.js';
import { IngestLeadSchema, UpdateLeadStatusSchema } from '../../types/api.js';
import type { IngestLeadInput, UpdateLeadStatusInput } from '../../types/api.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate, verifyTenant } from '../middleware/auth.js';
import { 
  sendSuccess, 
  sendCreated, 
  sendNotFound, 
  sendForbidden, 
  sendServerError,
  sendPaginated
} from '../../utils/response.js';
import { 
  createUuidParamSchema, 
  createMultiUuidParamSchema,
  getRouteParams, 
  getRequestBody,
  getPaginationParams,
  calculatePagination
} from '../../utils/validation.js';
import { 
  findById,
  verifyActiveCustomer,
  countRecords,
  buildFilteredQuery
} from '../../utils/database.js';
import { asyncHandler } from '../../utils/async-handler.js';

export async function leadRoutes(fastify: FastifyInstance) {
  
  // Ingest lead
  fastify.post('/ingest/:customerId', {
    preHandler: [authenticate, verifyTenant],
    schema: {
      body: IngestLeadSchema,
      ...createUuidParamSchema('customerId')
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { customerId } = getRouteParams(request, ['customerId']);
    const leadData = getRequestBody<IngestLeadInput>(request);
    
    try {
      // Verify customer exists and is active
      const customer = await verifyActiveCustomer(customerId);
    } catch (error) {
      if (error.name === 'EntityNotFoundError') {
        return sendNotFound(reply, 'Customer', customerId);
      }
      return sendForbidden(reply, error.message);
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

    return sendCreated(reply, newLead, 'Lead ingested successfully');
  }));

  // Get lead by ID
  fastify.get('/:id', {
    schema: createUuidParamSchema('id')
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = getRouteParams(request, ['id']);
    
    const lead = await findById(leads, id);

    if (!lead) {
      return sendNotFound(reply, 'Lead', id);
    }

    return sendSuccess(reply, lead);
  }));

  // List leads for customer
  fastify.get('/customer/:customerId', {
    preHandler: [authenticate, verifyTenant],
    schema: {
      ...createUuidParamSchema('customerId'),
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string' }
        }
      }
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { customerId } = getRouteParams(request, ['customerId']);
    const { page, limit } = getPaginationParams(request);
    const { status } = getRequestBody<{ status?: string }>(request.query) || {};
    
    try {
      // Verify customer exists and is active
      await verifyActiveCustomer(customerId);
    } catch (error) {
      if (error.name === 'EntityNotFoundError') {
        return sendNotFound(reply, 'Customer', customerId);
      }
      return sendForbidden(reply, error.message);
    }

    // Build query conditions
    const conditions = [eq(leads.customerId, customerId)];
    
    if (status) {
      conditions.push(eq(leads.status, status));
    }

    // Apply conditions and execute query
    const customerLeads = await buildFilteredQuery(leads, conditions)
      .orderBy(leads.createdAt)
      .limit(limit)
      .offset((page - 1) * limit);

    // Get total count for pagination
    const total = await countRecords(leads, conditions);

    const pagination = calculatePagination(total, page, limit);

    return sendPaginated(reply, customerLeads, pagination);
  }));

  // Update lead status
  fastify.patch('/:id/status', {
    preHandler: authenticate,
    schema: {
      ...createUuidParamSchema('id'),
      body: UpdateLeadStatusSchema
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = getRouteParams(request, ['id']);
    const { status } = getRequestBody<UpdateLeadStatusInput>(request);

    const [updatedLead] = await db
      .update(leads)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(leads.id, id))
      .returning();

    if (!updatedLead) {
      return sendNotFound(reply, 'Lead', id);
    }

    return sendSuccess(reply, updatedLead, 'Lead status updated successfully');
  }));
}
