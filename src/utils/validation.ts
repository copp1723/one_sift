import { FastifySchema } from 'fastify';
import { z } from 'zod';

/**
 * Common UUID pattern for validation
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Common schema fragments
 */
export const schemaFragments = {
  uuid: { type: 'string', format: 'uuid', pattern: UUID_PATTERN.source },
  email: { type: 'string', format: 'email' },
  phone: { type: 'string', pattern: '^[\\+]?[1-9][\\d]{0,15}$' },
  slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
  pagination: {
    type: 'object',
    properties: {
      page: { type: 'number', minimum: 1, default: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
    }
  },
  timestamp: { type: 'string', format: 'date-time' }
};

/**
 * Creates a Fastify schema for a route with a UUID parameter
 * 
 * @param paramName - The name of the UUID parameter
 * @returns Fastify schema object with UUID parameter validation
 * @example
 * ```ts
 * fastify.get('/:id', { 
 *   schema: createUuidParamSchema('id') 
 * }, async (request, reply) => {
 *   const { id } = getRouteParams(request, ['id']);
 *   // ...
 * });
 * ```
 */
export function createUuidParamSchema(paramName: string): FastifySchema {
  return {
    params: {
      type: 'object',
      required: [paramName],
      properties: {
        [paramName]: schemaFragments.uuid
      }
    }
  };
}

/**
 * Creates a Fastify schema for a route with multiple UUID parameters
 * 
 * @param paramNames - Array of UUID parameter names
 * @returns Fastify schema object with UUID parameter validation
 * @example
 * ```ts
 * fastify.get('/:customerId/leads/:leadId', { 
 *   schema: createMultiUuidParamSchema(['customerId', 'leadId']) 
 * }, async (request, reply) => {
 *   const { customerId, leadId } = getRouteParams(request, ['customerId', 'leadId']);
 *   // ...
 * });
 * ```
 */
export function createMultiUuidParamSchema(paramNames: string[]): FastifySchema {
  const properties: Record<string, any> = {};
  
  for (const name of paramNames) {
    properties[name] = schemaFragments.uuid;
  }
  
  return {
    params: {
      type: 'object',
      required: paramNames,
      properties
    }
  };
}

/**
 * Creates a Fastify schema for pagination query parameters
 * 
 * @returns Fastify schema object with pagination parameters
 * @example
 * ```ts
 * fastify.get('/customers', { 
 *   schema: {
 *     ...createPaginationSchema(),
 *     // Additional schema properties...
 *   }
 * }, async (request, reply) => {
 *   const { page, limit } = getPaginationParams(request);
 *   // ...
 * });
 * ```
 */
export function createPaginationSchema(): FastifySchema {
  return {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 1, default: 1 },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
      }
    }
  };
}

/**
 * Creates a Fastify schema for filtering by status
 * 
 * @param validStatuses - Array of valid status values
 * @returns Fastify schema object with status filter
 * @example
 * ```ts
 * fastify.get('/leads', { 
 *   schema: {
 *     ...createStatusFilterSchema(['new', 'processing', 'responded']),
 *     // Additional schema properties...
 *   }
 * }, async (request, reply) => {
 *   const { status } = getQueryParams(request, ['status']);
 *   // ...
 * });
 * ```
 */
export function createStatusFilterSchema(validStatuses: string[]): FastifySchema {
  return {
    querystring: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: validStatuses }
      }
    }
  };
}

/**
 * Creates a Fastify schema for date range filtering
 * 
 * @returns Fastify schema object with date range filter
 * @example
 * ```ts
 * fastify.get('/leads', { 
 *   schema: {
 *     ...createDateRangeSchema(),
 *     // Additional schema properties...
 *   }
 * }, async (request, reply) => {
 *   const { dateFrom, dateTo } = getQueryParams(request, ['dateFrom', 'dateTo']);
 *   // ...
 * });
 * ```
 */
export function createDateRangeSchema(): FastifySchema {
  return {
    querystring: {
      type: 'object',
      properties: {
        dateFrom: schemaFragments.timestamp,
        dateTo: schemaFragments.timestamp
      }
    }
  };
}

/**
 * Type-safe extraction of route parameters
 * 
 * @param request - Fastify request object
 * @param keys - Array of parameter keys to extract
 * @returns Object with typed parameter values
 * @example
 * ```ts
 * const { id } = getRouteParams(request, ['id']);
 * const { customerId, leadId } = getRouteParams(request, ['customerId', 'leadId']);
 * ```
 */
export function getRouteParams<T extends string>(
  request: any,
  keys: T[]
): Record<T, string> {
  const params: Record<string, string> = {};
  
  for (const key of keys) {
    params[key] = request.params[key];
    
    // Validate UUID format if it looks like an ID parameter
    if ((key === 'id' || key.endsWith('Id')) && !UUID_PATTERN.test(params[key])) {
      throw new Error(`Invalid UUID format for parameter: ${key}`);
    }
  }
  
  return params as Record<T, string>;
}

/**
 * Type-safe extraction of query parameters
 * 
 * @param request - Fastify request object
 * @param keys - Optional array of query parameter keys to extract
 * @returns Object with typed query parameter values
 * @example
 * ```ts
 * const { status, source } = getQueryParams(request, ['status', 'source']);
 * const allQueryParams = getQueryParams(request);
 * ```
 */
export function getQueryParams<T extends string>(
  request: any,
  keys?: T[]
): Record<T, any> {
  if (!keys) {
    return request.query || {};
  }
  
  const params: Record<string, any> = {};
  
  for (const key of keys) {
    params[key] = request.query[key];
  }
  
  return params as Record<T, any>;
}

/**
 * Type-safe extraction of request body
 * 
 * @template T - Expected body type
 * @param request - Fastify request object
 * @returns Typed request body
 * @example
 * ```ts
 * const customerData = getRequestBody<CreateCustomerInput>(request);
 * ```
 */
export function getRequestBody<T>(request: any): T {
  return request.body as T;
}

/**
 * Extract and validate pagination parameters
 * 
 * @param request - Fastify request object
 * @returns Object with page and limit values
 * @example
 * ```ts
 * const { page, limit } = getPaginationParams(request);
 * ```
 */
export function getPaginationParams(request: any): { page: number; limit: number } {
  const query = request.query || {};
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  
  // Validate pagination parameters
  if (page < 1) {
    throw new Error('Page must be greater than or equal to 1');
  }
  
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }
  
  return { page, limit };
}

/**
 * Calculate pagination metadata
 * 
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata object
 * @example
 * ```ts
 * const { page, limit } = getPaginationParams(request);
 * const total = await countRecords(leads, conditions);
 * const pagination = calculatePagination(total, page, limit);
 * ```
 */
export function calculatePagination(
  total: number,
  page: number,
  limit: number
): { total: number; page: number; limit: number; pages: number } {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Zod schema for pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

/**
 * Zod schema for UUID
 */
export const uuidSchema = z.string().uuid();

/**
 * Zod schema for email
 */
export const emailSchema = z.string().email();

/**
 * Zod schema for phone number
 */
export const phoneSchema = z.string().regex(/^[\+]?[1-9][\d]{0,15}$/);

/**
 * Zod schema for slug
 */
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

/**
 * Zod schema for date range
 */
export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

/**
 * Parse and validate a string as UUID
 * 
 * @param value - String to validate as UUID
 * @returns The UUID string if valid
 * @throws Error if the string is not a valid UUID
 * @example
 * ```ts
 * try {
 *   const validatedId = validateUuid(id);
 *   // Use validatedId...
 * } catch (error) {
 *   reply.status(400).send({ error: 'Invalid UUID format' });
 * }
 * ```
 */
export function validateUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error('Invalid UUID format');
  }
  return value;
}

/**
 * Validate an email address
 * 
 * @param email - Email address to validate
 * @returns The email if valid
 * @throws Error if the email is invalid
 * @example
 * ```ts
 * try {
 *   const validatedEmail = validateEmail(email);
 *   // Use validatedEmail...
 * } catch (error) {
 *   reply.status(400).send({ error: 'Invalid email format' });
 * }
 * ```
 */
export function validateEmail(email: string): string {
  try {
    return emailSchema.parse(email);
  } catch (error) {
    throw new Error('Invalid email format');
  }
}

/**
 * Validate a phone number
 * 
 * @param phone - Phone number to validate
 * @returns The phone number if valid
 * @throws Error if the phone number is invalid
 * @example
 * ```ts
 * try {
 *   const validatedPhone = validatePhone(phone);
 *   // Use validatedPhone...
 * } catch (error) {
 *   reply.status(400).send({ error: 'Invalid phone number format' });
 * }
 * ```
 */
export function validatePhone(phone: string): string {
  try {
    return phoneSchema.parse(phone);
  } catch (error) {
    throw new Error('Invalid phone number format');
  }
}
