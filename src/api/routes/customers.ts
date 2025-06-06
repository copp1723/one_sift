import { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { customers } from '../../db/schema.js';
import { createCustomerSchema, updateCustomerSchema } from '../../types/schemas.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../../types/schemas.js';
import { eq } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendConflict,
  sendInternalError
} from '../../utils/response.js';

export async function customerRoutes(fastify: FastifyInstance) {
  
  // Create customer
  fastify.post('/', {
    preHandler: authenticateToken,
    schema: {
      body: createCustomerSchema
    }
  }, async (request, reply) => {
    try {
      const customerData = request.body as CreateCustomerInput;

      // Check if slug already exists
      const existingCustomer = await db
        .select()
        .from(customers)
        .where(eq(customers.slug, customerData.slug))
        .limit(1);

      if (existingCustomer.length > 0) {
        sendConflict(reply, 'Customer with this slug already exists', request.id);
        return;
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

      sendCreated(reply, newCustomer, 'Customer created successfully');
    } catch (error) {
      sendInternalError(reply, 'Failed to create customer', request.id, error as Error);
    }
  });

  // Get customer by ID
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);

      if (!customer) {
        sendNotFound(reply, 'Customer', request.id);
        return;
      }

      sendSuccess(reply, customer);
    } catch (error) {
      sendInternalError(reply, 'Failed to fetch customer', request.id, error as Error);
    }
  });

  // Get customer by slug
  fastify.get<{ Params: { slug: string } }>('/slug/:slug', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.slug, slug))
        .limit(1);

      if (!customer) {
        sendNotFound(reply, 'Customer', request.id);
        return;
      }

      sendSuccess(reply, customer);
    } catch (error) {
      sendInternalError(reply, 'Failed to fetch customer', request.id, error as Error);
    }
  });

  // List customers
  fastify.get('/', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const allCustomers = await db
        .select()
        .from(customers)
        .orderBy(customers.createdAt);

      sendSuccess(reply, allCustomers);
    } catch (error) {
      sendInternalError(reply, 'Failed to fetch customers', request.id, error as Error);
    }
  });

  // Update customer
  fastify.patch('/:id', {
    preHandler: authenticateToken,
    schema: {
      body: updateCustomerSchema
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as UpdateCustomerInput;

      const [updatedCustomer] = await db
        .update(customers)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updatedCustomer) {
        sendNotFound(reply, 'Customer', request.id);
        return;
      }

      sendSuccess(reply, updatedCustomer, { message: 'Customer updated successfully' });
    } catch (error) {
      sendInternalError(reply, 'Failed to update customer', request.id, error as Error);
    }
  });
}
