import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { customers } from '../../db/schema.js';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../../types/api.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../../types/api.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';

export async function customerRoutes(fastify: FastifyInstance) {
  
  // Create customer
  fastify.post('/', {
    preHandler: authenticate,
    schema: {
      body: CreateCustomerSchema
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const customerData = request.body as CreateCustomerInput;
      
      // Check if slug already exists
      const existingCustomer = await db
        .select()
        .from(customers)
        .where(eq(customers.slug, customerData.slug))
        .limit(1);
      
      if (existingCustomer.length > 0) {
        reply.status(409).send({
          error: 'Conflict',
          message: 'Customer with this slug already exists'
        });
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

      reply.status(201).send({
        success: true,
        data: newCustomer
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create customer'
      });
    }
  });

  // Get customer by ID
  fastify.get('/:id', { 
    preHandler: authenticate,
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
      
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);

      if (!customer) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      reply.send({
        success: true,
        data: customer
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch customer'
      });
    }
  });

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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { slug } = request.params as { slug: string };
      
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.slug, slug))
        .limit(1);

      if (!customer) {
        reply.status(404).send({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      reply.send({
        success: true,
        data: customer
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch customer'
      });
    }
  });

  // List customers
  fastify.get('/', { preHandler: authenticate }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allCustomers = await db
        .select()
        .from(customers)
        .orderBy(customers.createdAt);

      reply.send({
        success: true,
        data: allCustomers
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch customers'
      });
    }
  });

  // Update customer
  fastify.patch('/:id', {
    preHandler: authenticate,
    schema: {
      body: UpdateCustomerSchema,
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
        reply.status(404).send({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      reply.send({
        success: true,
        data: updatedCustomer
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update customer'
      });
    }
  });
}
