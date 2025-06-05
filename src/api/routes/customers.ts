import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { customers } from '../../db/schema.js';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../../types/api.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../../types/api.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { 
  sendSuccess, 
  sendCreated, 
  sendNotFound, 
  sendConflict, 
  sendServerError 
} from '../../utils/response.js';
import { 
  createUuidParamSchema, 
  getRouteParams, 
  getRequestBody 
} from '../../utils/validation.js';
import { 
  findById, 
  findByField, 
  notExists 
} from '../../utils/database.js';
import { asyncHandler } from '../../utils/async-handler.js';

export async function customerRoutes(fastify: FastifyInstance) {
  
  // Create customer
  fastify.post('/', {
    preHandler: authenticate,
    schema: {
      body: CreateCustomerSchema
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const customerData = getRequestBody<CreateCustomerInput>(request);
    
    // Check if slug already exists
    const slugExists = !(await notExists(customers, 'slug', customerData.slug));
    
    if (slugExists) {
      return sendConflict(reply, 'Customer with this slug already exists');
    }

    // Generate email address for email mode
    let emailAddress: string | undefined;
    if (customerData.ingestionMode === 'email') {
      emailAddress = `ai-${customerData.slug}@onesift.com`;
    }

    // Create customer
    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...customerData,
        emailAddress,
        metadata: customerData.metadata || {}
      })
      .returning();

    return sendCreated(reply, newCustomer, 'Customer created successfully');
  }));

  // Get customer by ID
  fastify.get('/:id', { 
    preHandler: authenticate,
    schema: createUuidParamSchema('id')
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = getRouteParams(request, ['id']);
    
    const customer = await findById(customers, id);

    if (!customer) {
      return sendNotFound(reply, 'Customer', id);
    }

    return sendSuccess(reply, customer);
  }));

  // Get customer by slug
  fastify.get('/slug/:slug', { 
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' }
        },
        required: ['slug']
      }
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = getRouteParams(request, ['slug']);
    
    const customer = await findByField(customers, 'slug', slug);

    if (!customer) {
      return sendNotFound(reply, 'Customer', `slug:${slug}`);
    }

    return sendSuccess(reply, customer);
  }));

  // List customers
  fastify.get('/', { 
    preHandler: authenticate 
  }, asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const allCustomers = await db
      .select()
      .from(customers)
      .orderBy(customers.createdAt);

    return sendSuccess(reply, allCustomers);
  }));

  // Update customer
  fastify.patch('/:id', {
    preHandler: authenticate,
    schema: {
      body: UpdateCustomerSchema,
      ...createUuidParamSchema('id')
    }
  }, asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = getRouteParams(request, ['id']);
    const updateData = getRequestBody<UpdateCustomerInput>(request);

    const [updatedCustomer] = await db
      .update(customers)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(customers.id, id))
      .returning();

    if (!updatedCustomer) {
      return sendNotFound(reply, 'Customer', id);
    }

    return sendSuccess(reply, updatedCustomer, 'Customer updated successfully');
  }));
}
