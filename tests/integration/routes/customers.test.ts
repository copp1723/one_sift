import { FastifyInstance } from 'fastify';
import { createServer } from '../../../src/api/server.js';
import jwt from 'jsonwebtoken';

describe('Customer Routes', () => {
  let server: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    server = await createServer();
    await server.ready();

    // Create a test auth token
    authToken = jwt.sign(
      {
        userId: 'test-user',
        tenantId: 'test-tenant',
        email: 'test@example.com'
      },
      'test-api-key-secret'
    );
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /api/v1/customers', () => {
    it('should create a new customer with valid data', async () => {
      const customerData = {
        name: 'Test Dealership',
        slug: 'test-dealership',
        ingestionMode: 'email',
        handoverEmail: 'sales@testdealership.com',
        handoverThreshold: 5,
        metadata: { location: 'Test City' }
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        payload: customerData
      });

      expect(response.statusCode).toBe(201);
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(customerData.name);
      expect(result.data.slug).toBe(customerData.slug);
      expect(result.data.ingestionMode).toBe(customerData.ingestionMode);
      expect(result.data.emailAddress).toBe('ai-test-dealership@onesift.com');
      expect(result.data.id).toBeDefined();
    });

    it('should reject customer creation without authentication', async () => {
      const customerData = {
        name: 'Unauthorized Test',
        slug: 'unauthorized-test',
        ingestionMode: 'email',
        handoverEmail: 'test@test.com'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          'content-type': 'application/json'
        },
        payload: customerData
      });

      expect(response.statusCode).toBe(401);
      
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Unauthorized');
    });

    it('should reject customer with invalid data', async () => {
      const invalidCustomerData = {
        name: '',  // Invalid: empty name
        slug: 'invalid-slug!',  // Invalid: contains special character
        ingestionMode: 'invalid-mode',  // Invalid: not email or api
        handoverEmail: 'not-an-email'  // Invalid: not a valid email
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        payload: invalidCustomerData
      });

      expect(response.statusCode).toBe(400);
      
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Validation Error');
    });

    it('should reject duplicate slug', async () => {
      const customerData = {
        name: 'Duplicate Test',
        slug: 'test-dealership',  // Same slug as first test
        ingestionMode: 'api',
        handoverEmail: 'duplicate@test.com'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        payload: customerData
      });

      expect(response.statusCode).toBe(409);
      
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Conflict');
      expect(result.message).toContain('slug already exists');
    });

    it('should create customer with API ingestion mode', async () => {
      const customerData = {
        name: 'API Customer',
        slug: 'api-customer',
        ingestionMode: 'api',
        handoverEmail: 'api@customer.com'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        payload: customerData
      });

      expect(response.statusCode).toBe(201);
      
      const result = JSON.parse(response.payload);
      expect(result.data.emailAddress).toBeUndefined(); // No email for API mode
      expect(result.data.ingestionMode).toBe('api');
    });
  });

  describe('GET /api/v1/customers/:id', () => {
    let customerId: string;

    beforeAll(async () => {
      // Create a customer for testing
      const customerData = {
        name: 'Get Test Customer',
        slug: 'get-test-customer',
        ingestionMode: 'email',
        handoverEmail: 'get@test.com'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json'
        },
        payload: customerData
      });

      const result = JSON.parse(response.payload);
      customerId = result.data.id;
    });

    it('should get customer by ID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/customers/${customerId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(customerId);
      expect(result.data.name).toBe('Get Test Customer');
    });

    it('should return 404 for non-existent customer', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/customers/non-existent-id',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('Not Found');
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/customers/${customerId}`
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/customers/slug/:slug', () => {
    it('should get customer by slug', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/customers/slug/test-dealership',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data.slug).toBe('test-dealership');
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/customers/slug/non-existent-slug',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/customers', () => {
    it('should list all customers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/customers',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/customers'
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
