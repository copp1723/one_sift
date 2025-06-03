import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { customers } from '../../db/schema.js';
import { createCustomerSchema, updateCustomerSchema } from '../../types/schemas.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../../types/schemas.js';
import { eq } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';

export async function customerRoutes(fastify: FastifyInstance) {
  
  // Create customer
  fastify.post('/', {
    preHandler: authenticateToken,
    schema: {
      body: createCustomerSchema
    }
  }, async (request: FastifyRequest<{ Body: CreateCustomerInput }>, reply: FastifyReply) => {
    try {
      const customerData = request.body;
      
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
  fastify.get('/:id', { preHandler: authenticateToken }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
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
  fastify.get('/slug/:slug', { preHandler: authenticateToken }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      
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
  fastify.get('/', { preHandler: authenticateToken }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    preHandler: authenticateToken,
    schema: {
      body: updateCustomerSchema
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateCustomerInput }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;

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
