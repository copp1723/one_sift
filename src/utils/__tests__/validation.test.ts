import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  UUID_PATTERN,
  schemaFragments,
  createUuidParamSchema,
  createMultiUuidParamSchema,
  createPaginationSchema,
  createStatusFilterSchema,
  createDateRangeSchema,
  getRouteParams,
  getQueryParams,
  getRequestBody,
  getPaginationParams,
  calculatePagination,
  validateUuid,
  validateEmail,
  validatePhone,
  paginationSchema,
  uuidSchema,
  emailSchema,
  phoneSchema,
  slugSchema,
  dateRangeSchema
} from '../validation.js';
import { FastifyRequest } from 'fastify';
import { z } from 'zod';

// Mock Fastify request object
const createMockRequest = (overrides = {}) => {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides
  } as unknown as FastifyRequest;
};

describe('Validation Utilities', () => {
  describe('Constants and Schema Fragments', () => {
    test('UUID_PATTERN should match valid UUIDs', () => {
      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11' // Case insensitive
      ];
      
      validUuids.forEach(uuid => {
        expect(UUID_PATTERN.test(uuid)).toBe(true);
      });
    });

    test('UUID_PATTERN should reject invalid UUIDs', () => {
      const invalidUuids = [
        '123e4567-e89b-12d3-a456', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
        '123e4567-e89b-12d3-a456-42661417400g', // Invalid character
        '123e4567-e89b_12d3-a456-426614174000', // Invalid separator
        'not-a-uuid'
      ];
      
      invalidUuids.forEach(uuid => {
        expect(UUID_PATTERN.test(uuid)).toBe(false);
      });
    });

    test('schemaFragments should contain all expected fragments', () => {
      expect(schemaFragments).toHaveProperty('uuid');
      expect(schemaFragments).toHaveProperty('email');
      expect(schemaFragments).toHaveProperty('phone');
      expect(schemaFragments).toHaveProperty('slug');
      expect(schemaFragments).toHaveProperty('pagination');
      expect(schemaFragments).toHaveProperty('timestamp');
    });

    test('schemaFragments should have correct formats', () => {
      expect(schemaFragments.uuid).toHaveProperty('format', 'uuid');
      expect(schemaFragments.email).toHaveProperty('format', 'email');
      expect(schemaFragments.phone).toHaveProperty('pattern');
      expect(schemaFragments.slug).toHaveProperty('pattern');
      expect(schemaFragments.pagination).toHaveProperty('properties');
      expect(schemaFragments.timestamp).toHaveProperty('format', 'date-time');
    });
  });

  describe('Schema Builder Functions', () => {
    test('createUuidParamSchema should create a schema with UUID parameter', () => {
      const schema = createUuidParamSchema('id');
      
      expect(schema).toHaveProperty('params');
      expect(schema.params).toHaveProperty('type', 'object');
      expect(schema.params).toHaveProperty('required', ['id']);
      expect(schema.params.properties).toHaveProperty('id');
      expect(schema.params.properties.id).toEqual(schemaFragments.uuid);
    });

    test('createMultiUuidParamSchema should create a schema with multiple UUID parameters', () => {
      const paramNames = ['customerId', 'leadId'];
      const schema = createMultiUuidParamSchema(paramNames);
      
      expect(schema).toHaveProperty('params');
      expect(schema.params).toHaveProperty('type', 'object');
      expect(schema.params).toHaveProperty('required', paramNames);
      expect(schema.params.properties).toHaveProperty('customerId');
      expect(schema.params.properties).toHaveProperty('leadId');
      expect(schema.params.properties.customerId).toEqual(schemaFragments.uuid);
      expect(schema.params.properties.leadId).toEqual(schemaFragments.uuid);
    });

    test('createMultiUuidParamSchema should handle empty array', () => {
      const schema = createMultiUuidParamSchema([]);
      
      expect(schema).toHaveProperty('params');
      expect(schema.params).toHaveProperty('required', []);
      expect(schema.params.properties).toEqual({});
    });

    test('createPaginationSchema should create a schema with pagination parameters', () => {
      const schema = createPaginationSchema();
      
      expect(schema).toHaveProperty('querystring');
      expect(schema.querystring).toHaveProperty('type', 'object');
      expect(schema.querystring.properties).toHaveProperty('page');
      expect(schema.querystring.properties).toHaveProperty('limit');
      expect(schema.querystring.properties.page).toHaveProperty('default', 1);
      expect(schema.querystring.properties.limit).toHaveProperty('default', 20);
    });

    test('createStatusFilterSchema should create a schema with status filter', () => {
      const validStatuses = ['new', 'processing', 'completed'];
      const schema = createStatusFilterSchema(validStatuses);
      
      expect(schema).toHaveProperty('querystring');
      expect(schema.querystring.properties).toHaveProperty('status');
      expect(schema.querystring.properties.status).toHaveProperty('enum', validStatuses);
    });

    test('createStatusFilterSchema should handle empty array', () => {
      const schema = createStatusFilterSchema([]);
      
      expect(schema).toHaveProperty('querystring');
      expect(schema.querystring.properties).toHaveProperty('status');
      expect(schema.querystring.properties.status).toHaveProperty('enum', []);
    });

    test('createDateRangeSchema should create a schema with date range parameters', () => {
      const schema = createDateRangeSchema();
      
      expect(schema).toHaveProperty('querystring');
      expect(schema.querystring.properties).toHaveProperty('dateFrom');
      expect(schema.querystring.properties).toHaveProperty('dateTo');
      expect(schema.querystring.properties.dateFrom).toEqual(schemaFragments.timestamp);
      expect(schema.querystring.properties.dateTo).toEqual(schemaFragments.timestamp);
    });
  });

  describe('Request Parameter Extractors', () => {
    test('getRouteParams should extract route parameters', () => {
      const request = createMockRequest({
        params: { id: '123e4567-e89b-12d3-a456-426614174000' }
      });
      
      const params = getRouteParams(request, ['id']);
      expect(params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    test('getRouteParams should extract multiple parameters', () => {
      const request = createMockRequest({
        params: {
          customerId: '123e4567-e89b-12d3-a456-426614174000',
          leadId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        }
      });
      
      const params = getRouteParams(request, ['customerId', 'leadId']);
      expect(params).toEqual({
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        leadId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      });
    });

    test('getRouteParams should throw error for invalid UUID format', () => {
      const request = createMockRequest({
        params: { id: 'not-a-uuid' }
      });
      
      expect(() => getRouteParams(request, ['id'])).toThrow('Invalid UUID format');
    });

    test('getRouteParams should not validate non-ID parameters', () => {
      const request = createMockRequest({
        params: { slug: 'test-slug' }
      });
      
      const params = getRouteParams(request, ['slug']);
      expect(params).toEqual({ slug: 'test-slug' });
    });

    test('getQueryParams should extract query parameters', () => {
      const request = createMockRequest({
        query: { status: 'active', sort: 'desc' }
      });
      
      const params = getQueryParams(request, ['status', 'sort']);
      expect(params).toEqual({ status: 'active', sort: 'desc' });
    });

    test('getQueryParams should return all query parameters when keys not provided', () => {
      const query = { status: 'active', sort: 'desc', page: '1' };
      const request = createMockRequest({ query });
      
      const params = getQueryParams(request);
      expect(params).toEqual(query);
    });

    test('getQueryParams should handle missing parameters', () => {
      const request = createMockRequest({
        query: { status: 'active' }
      });
      
      const params = getQueryParams(request, ['status', 'sort']);
      expect(params).toEqual({ status: 'active', sort: undefined });
    });

    test('getRequestBody should extract and type request body', () => {
      interface TestBody {
        name: string;
        email: string;
      }
      
      const body = { name: 'Test User', email: 'test@example.com' };
      const request = createMockRequest({ body });
      
      const result = getRequestBody<TestBody>(request);
      expect(result).toEqual(body);
    });

    test('getPaginationParams should extract pagination parameters', () => {
      const request = createMockRequest({
        query: { page: '2', limit: '50' }
      });
      
      const pagination = getPaginationParams(request);
      expect(pagination).toEqual({ page: 2, limit: 50 });
    });

    test('getPaginationParams should use default values when not provided', () => {
      const request = createMockRequest({
        query: {}
      });
      
      const pagination = getPaginationParams(request);
      expect(pagination).toEqual({ page: 1, limit: 20 });
    });

    test('getPaginationParams should throw error for invalid page', () => {
      const request = createMockRequest({
        query: { page: '0' }
      });
      
      expect(() => getPaginationParams(request)).toThrow('Page must be greater than or equal to 1');
    });

    test('getPaginationParams should throw error for invalid limit', () => {
      const request = createMockRequest({
        query: { limit: '200' }
      });
      
      expect(() => getPaginationParams(request)).toThrow('Limit must be between 1 and 100');
    });

    test('getPaginationParams should handle string values', () => {
      const request = createMockRequest({
        query: { page: '5', limit: '10' }
      });
      
      const pagination = getPaginationParams(request);
      expect(pagination).toEqual({ page: 5, limit: 10 });
    });
  });

  describe('Pagination Calculation', () => {
    test('calculatePagination should calculate pagination metadata', () => {
      const pagination = calculatePagination(100, 2, 20);
      
      expect(pagination).toEqual({
        total: 100,
        page: 2,
        limit: 20,
        pages: 5
      });
    });

    test('calculatePagination should handle partial pages', () => {
      const pagination = calculatePagination(101, 2, 20);
      
      expect(pagination).toEqual({
        total: 101,
        page: 2,
        limit: 20,
        pages: 6
      });
    });

    test('calculatePagination should handle zero total', () => {
      const pagination = calculatePagination(0, 1, 20);
      
      expect(pagination).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        pages: 0
      });
    });

    test('calculatePagination should handle single page', () => {
      const pagination = calculatePagination(5, 1, 20);
      
      expect(pagination).toEqual({
        total: 5,
        page: 1,
        limit: 20,
        pages: 1
      });
    });
  });

  describe('Validation Functions', () => {
    test('validateUuid should accept valid UUIDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(validateUuid(uuid)).toBe(uuid);
    });

    test('validateUuid should throw error for invalid UUIDs', () => {
      expect(() => validateUuid('not-a-uuid')).toThrow('Invalid UUID format');
    });

    test('validateEmail should accept valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@example.co.uk',
        'user-name@example.io'
      ];
      
      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(email);
      });
    });

    test('validateEmail should throw error for invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@missing-user.com',
        'user@.com'
      ];
      
      invalidEmails.forEach(email => {
        expect(() => validateEmail(email)).toThrow('Invalid email format');
      });
    });

    test('validatePhone should accept valid phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '+442071234567',
        '123456789'
      ];
      
      validPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(phone);
      });
    });

    test('validatePhone should throw error for invalid phone numbers', () => {
      const invalidPhones = [
        'not-a-phone',
        '+',
        '0',
        '+0'
      ];
      
      invalidPhones.forEach(phone => {
        expect(() => validatePhone(phone)).toThrow('Invalid phone number format');
      });
    });
  });

  describe('Zod Schemas', () => {
    test('paginationSchema should validate valid pagination', () => {
      const valid = { page: 1, limit: 20 };
      expect(paginationSchema.parse(valid)).toEqual(valid);
    });

    test('paginationSchema should coerce string values', () => {
      const input = { page: '2', limit: '30' };
      expect(paginationSchema.parse(input)).toEqual({ page: 2, limit: 30 });
    });

    test('paginationSchema should use default values', () => {
      expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    });

    test('paginationSchema should reject invalid values', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });

    test('uuidSchema should validate valid UUIDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.parse(uuid)).toBe(uuid);
    });

    test('uuidSchema should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    });

    test('emailSchema should validate valid emails', () => {
      const email = 'test@example.com';
      expect(emailSchema.parse(email)).toBe(email);
    });

    test('emailSchema should reject invalid emails', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
    });

    test('phoneSchema should validate valid phone numbers', () => {
      const phone = '+1234567890';
      expect(phoneSchema.parse(phone)).toBe(phone);
    });

    test('phoneSchema should reject invalid phone numbers', () => {
      expect(() => phoneSchema.parse('not-a-phone')).toThrow();
    });

    test('slugSchema should validate valid slugs', () => {
      const validSlugs = [
        'test-slug',
        'test123',
        '123-test'
      ];
      
      validSlugs.forEach(slug => {
        expect(slugSchema.parse(slug)).toBe(slug);
      });
    });

    test('slugSchema should reject invalid slugs', () => {
      const invalidSlugs = [
        'Test Slug',
        'test_slug',
        'test slug',
        'test@slug'
      ];
      
      invalidSlugs.forEach(slug => {
        expect(() => slugSchema.parse(slug)).toThrow();
      });
    });

    test('dateRangeSchema should validate valid date ranges', () => {
      const validRange = {
        dateFrom: '2023-01-01T00:00:00Z',
        dateTo: '2023-01-31T23:59:59Z'
      };
      
      expect(dateRangeSchema.parse(validRange)).toEqual(validRange);
    });

    test('dateRangeSchema should handle optional fields', () => {
      expect(dateRangeSchema.parse({})).toEqual({});
      expect(dateRangeSchema.parse({ dateFrom: '2023-01-01T00:00:00Z' }))
        .toEqual({ dateFrom: '2023-01-01T00:00:00Z' });
    });

    test('dateRangeSchema should reject invalid dates', () => {
      expect(() => dateRangeSchema.parse({ dateFrom: 'not-a-date' })).toThrow();
      expect(() => dateRangeSchema.parse({ dateTo: '2023-01-01' })).toThrow();
    });
  });
});
