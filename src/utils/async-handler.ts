import { FastifyRequest, FastifyReply, FastifyInstance, RouteHandlerMethod } from 'fastify';
import { db } from '../db/index.js';
import { PgTable } from 'drizzle-orm/pg-core';
import { SQL } from 'drizzle-orm';

/**
 * Options for the async route handler
 */
export interface AsyncRouteOptions {
  /** Whether to log errors (defaults to true) */
  logErrors?: boolean;
  /** Custom error handler function */
  errorHandler?: (error: Error, request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Wraps a route handler with try/catch and standardized error handling
 * 
 * @param handler - The route handler function
 * @param options - Options for the async handler
 * @returns A wrapped route handler with error handling
 * @example
 * ```ts
 * fastify.get('/customers/:id', {
 *   schema: { ... }
 * }, asyncHandler(async (request, reply) => {
 *   const { id } = request.params as { id: string };
 *   const customer = await findById(customers, id, { throwIfNotFound: true });
 *   return reply.send({ success: true, data: customer });
 * }));
 * ```
 */
export function asyncHandler(
  handler: RouteHandlerMethod,
  options: AsyncRouteOptions = {}
): RouteHandlerMethod {
  const { logErrors = true, errorHandler, timeout } = options;
  
  return async function(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (timeout) {
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Request timeout after ${timeout}ms`));
          }, timeout);
        });
        
        // Execute handler with timeout
        await Promise.race([
          handler(request, reply),
          timeoutPromise
        ]);
        
        // Clear timeout if handler completes
        if (timeoutId) clearTimeout(timeoutId);
      } else {
        // Execute handler without timeout
        await handler(request, reply);
      }
    } catch (error) {
      // Clear timeout if it exists
      if (timeout && timeoutId) clearTimeout(timeoutId);
      
      // Log error if enabled
      if (logErrors && request.log) {
        request.log.error(error);
      }
      
      // Use custom error handler if provided
      if (errorHandler) {
        await errorHandler(error as Error, request, reply);
        return;
      }
      
      // Default error handling
      if (!reply.sent) {
        const statusCode = determineStatusCode(error as Error);
        const errorMessage = getErrorMessage(error as Error);
        
        reply.status(statusCode).send({
          success: false,
          error: getErrorType(error as Error),
          message: errorMessage
        });
      }
    }
  };
}

/**
 * Wraps multiple route handlers with the asyncHandler
 * 
 * @param handlers - Object containing route handlers
 * @param options - Options for the async handler
 * @returns Object with wrapped route handlers
 * @example
 * ```ts
 * const handlers = asyncHandlers({
 *   getCustomer: async (request, reply) => {
 *     const { id } = request.params as { id: string };
 *     const customer = await findById(customers, id, { throwIfNotFound: true });
 *     return reply.send({ success: true, data: customer });
 *   },
 *   createCustomer: async (request, reply) => {
 *     // ...
 *   }
 * });
 * 
 * fastify.get('/customers/:id', handlers.getCustomer);
 * fastify.post('/customers', handlers.createCustomer);
 * ```
 */
export function asyncHandlers<T extends Record<string, RouteHandlerMethod>>(
  handlers: T,
  options: AsyncRouteOptions = {}
): T {
  const wrappedHandlers = {} as T;
  
  for (const [key, handler] of Object.entries(handlers)) {
    wrappedHandlers[key as keyof T] = asyncHandler(handler, options) as any;
  }
  
  return wrappedHandlers;
}

/**
 * Register async routes with error handling
 * 
 * @param fastify - Fastify instance
 * @param routes - Route configuration objects
 * @param options - Options for the async handler
 * @example
 * ```ts
 * registerAsyncRoutes(fastify, [
 *   {
 *     method: 'GET',
 *     url: '/customers/:id',
 *     schema: { ... },
 *     handler: async (request, reply) => {
 *       const { id } = request.params as { id: string };
 *       const customer = await findById(customers, id, { throwIfNotFound: true });
 *       return reply.send({ success: true, data: customer });
 *     }
 *   },
 *   {
 *     method: 'POST',
 *     url: '/customers',
 *     schema: { ... },
 *     handler: async (request, reply) => {
 *       // ...
 *     }
 *   }
 * ]);
 * ```
 */
export function registerAsyncRoutes(
  fastify: FastifyInstance,
  routes: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    url: string;
    schema?: any;
    preHandler?: any;
    handler: RouteHandlerMethod;
  }>,
  options: AsyncRouteOptions = {}
): void {
  for (const route of routes) {
    const { method, url, schema, preHandler, handler } = route;
    
    fastify[method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'](
      url,
      { schema, preHandler },
      asyncHandler(handler, options)
    );
  }
}

/**
 * Execute a function with retry logic
 * 
 * @template T - Return type of the function
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function
 * @throws Error if all retries fail
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => {
 *     return await externalApi.fetchData();
 *   },
 *   {
 *     retries: 3,
 *     delay: 1000,
 *     backoff: 'exponential',
 *     shouldRetry: (error) => error.code === 'NETWORK_ERROR'
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: 'fixed' | 'exponential' | 'linear';
    factor?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    backoff = 'exponential',
    factor = 2,
    shouldRetry = () => true,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === retries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Calculate delay based on backoff strategy
      let waitTime = delay;
      if (backoff === 'exponential') {
        waitTime = delay * Math.pow(factor, attempt);
      } else if (backoff === 'linear') {
        waitTime = delay * (attempt + 1);
      }
      
      // Notify retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // This should never happen due to the throw in the loop
  throw lastError!;
}

/**
 * Execute a database operation within a transaction
 * 
 * @template T - Return type of the operation
 * @param operation - Function that performs database operations
 * @returns Result of the operation
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const [customer] = await tx.insert(customers).values(customerData).returning();
 *   await tx.insert(leads).values({ ...leadData, customerId: customer.id });
 *   return customer;
 * });
 * ```
 */
export async function withTransaction<T>(
  operation: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(operation);
}

/**
 * Execute database operations with automatic retries for transient errors
 * 
 * @template T - Return type of the operation
 * @param operation - Function that performs database operations
 * @param options - Retry options
 * @returns Result of the operation
 * @example
 * ```ts
 * const customer = await withDatabaseRetry(async () => {
 *   const [customer] = await db.insert(customers).values(customerData).returning();
 *   return customer;
 * });
 * ```
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
  } = {}
): Promise<T> {
  const { retries = 3, delay = 500 } = options;
  
  // Common transient database error codes
  const transientErrors = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
    '53300', // too_many_connections
    '55P03'  // lock_not_available
  ];
  
  return withRetry(operation, {
    retries,
    delay,
    backoff: 'exponential',
    shouldRetry: (error) => {
      // Only retry on known transient errors
      if (error.code && transientErrors.includes(error.code)) {
        return true;
      }
      
      // Check for connection errors
      if (error.message && /connection/i.test(error.message)) {
        return true;
      }
      
      return false;
    }
  });
}

/**
 * Execute multiple async operations in parallel with a concurrency limit
 * 
 * @template T - Input item type
 * @template R - Result type
 * @param items - Array of items to process
 * @param fn - Function to process each item
 * @param options - Concurrency options
 * @returns Array of results
 * @example
 * ```ts
 * const results = await withConcurrency(
 *   customerIds,
 *   async (id) => {
 *     return await fetchCustomerDetails(id);
 *   },
 *   { concurrency: 5 }
 * );
 * ```
 */
export async function withConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    abortOnError?: boolean;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { 
    concurrency = 5, 
    abortOnError = false,
    onProgress
  } = options;
  
  const results: R[] = new Array(items.length);
  const errors: Error[] = [];
  let running = 0;
  let index = 0;
  let completed = 0;
  
  return new Promise((resolve, reject) => {
    const processNext = async () => {
      const currentIndex = index++;
      
      if (currentIndex >= items.length) {
        if (--running === 0) {
          if (errors.length > 0 && abortOnError) {
            reject(errors[0]);
          } else {
            resolve(results);
          }
        }
        return;
      }
      
      running++;
      
      try {
        results[currentIndex] = await fn(items[currentIndex], currentIndex);
      } catch (error) {
        errors.push(error as Error);
        
        if (abortOnError) {
          reject(error);
          return;
        }
      }
      
      completed++;
      
      if (onProgress) {
        onProgress(completed, items.length);
      }
      
      processNext();
    };
    
    // Start initial batch of tasks
    const initialBatch = Math.min(concurrency, items.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
    
    // Handle empty array case
    if (items.length === 0) {
      resolve([]);
    }
  });
}

/**
 * Execute an async operation with a timeout
 * 
 * @template T - Return type of the operation
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Result of the function
 * @throws Error if the operation times out
 * @example
 * ```ts
 * try {
 *   const result = await withTimeout(
 *     () => externalApi.fetchData(),
 *     5000,
 *     'API request timed out'
 *   );
 * } catch (error) {
 *   // Handle timeout error
 * }
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
    
    try {
      const result = await fn();
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Create a logger middleware for Fastify
 * 
 * @param options - Logger options
 * @returns Fastify middleware function
 * @example
 * ```ts
 * // Register logger middleware
 * fastify.addHook('onRequest', createLoggerMiddleware({
 *   logBody: true,
 *   logHeaders: ['user-agent', 'content-type'],
 *   excludePaths: ['/health', '/metrics']
 * }));
 * ```
 */
export function createLoggerMiddleware(
  options: {
    logBody?: boolean;
    logHeaders?: string[];
    excludePaths?: string[];
    logLevel?: 'info' | 'debug' | 'trace';
  } = {}
) {
  const {
    logBody = false,
    logHeaders = ['user-agent', 'content-type'],
    excludePaths = ['/health', '/metrics'],
    logLevel = 'info'
  } = options;
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip excluded paths
    if (excludePaths.some(path => request.url.startsWith(path))) {
      return;
    }
    
    const startTime = process.hrtime();
    
    // Log request
    const requestLog: Record<string, any> = {
      method: request.method,
      url: request.url,
      id: request.id
    };
    
    // Add headers if configured
    if (logHeaders.length > 0) {
      requestLog.headers = {};
      for (const header of logHeaders) {
        if (request.headers[header]) {
          requestLog.headers[header] = request.headers[header];
        }
      }
    }
    
    // Add body if configured and present
    if (logBody && request.body) {
      requestLog.body = request.body;
    }
    
    request.log[logLevel]({ req: requestLog }, 'Incoming request');
    
    // Add response logger
    reply.addHook('onSend', (_, payload, done) => {
      const responseTime = calculateResponseTime(startTime);
      
      request.log[logLevel](
        {
          res: {
            statusCode: reply.statusCode,
            responseTime
          }
        },
        'Request completed'
      );
      
      done(null, payload);
    });
  };
}

/**
 * Calculate response time in milliseconds from hrtime
 */
function calculateResponseTime(startTime: [number, number]): number {
  const diff = process.hrtime(startTime);
  return diff[0] * 1000 + diff[1] / 1000000;
}

/**
 * Determine appropriate HTTP status code from error
 */
function determineStatusCode(error: Error): number {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'EntityNotFoundError') return 404;
  if (error.name === 'UnauthorizedError') return 401;
  if (error.name === 'ForbiddenError') return 403;
  if (error.name === 'ConflictError') return 409;
  if (error.name === 'TimeoutError') return 408;
  if (error.name === 'BadGatewayError') return 502;
  if (error.name === 'ServiceUnavailableError') return 503;
  
  // Check for common error messages
  const message = error.message.toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('unauthorized') || message.includes('unauthenticated')) return 401;
  if (message.includes('forbidden') || message.includes('permission')) return 403;
  if (message.includes('conflict') || message.includes('already exists')) return 409;
  if (message.includes('timeout')) return 408;
  if (message.includes('validation') || message.includes('invalid')) return 400;
  
  // Default to 500
  return 500;
}

/**
 * Get appropriate error type from error
 */
function getErrorType(error: Error): string {
  if (error.name === 'ValidationError') return 'Bad Request';
  if (error.name === 'EntityNotFoundError') return 'Not Found';
  if (error.name === 'UnauthorizedError') return 'Unauthorized';
  if (error.name === 'ForbiddenError') return 'Forbidden';
  if (error.name === 'ConflictError') return 'Conflict';
  if (error.name === 'TimeoutError') return 'Request Timeout';
  if (error.name === 'BadGatewayError') return 'Bad Gateway';
  if (error.name === 'ServiceUnavailableError') return 'Service Unavailable';
  
  // Map HTTP status code to error type
  const statusCode = determineStatusCode(error);
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 408: return 'Request Timeout';
    case 409: return 'Conflict';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    default: return 'Internal Server Error';
  }
}

/**
 * Get appropriate error message from error
 */
function getErrorMessage(error: Error): string {
  // In production, sanitize error messages for security
  if (process.env.NODE_ENV === 'production') {
    const statusCode = determineStatusCode(error);
    
    // Don't expose detailed error messages for server errors
    if (statusCode >= 500) {
      return 'An unexpected error occurred';
    }
  }
  
  return error.message;
}

/**
 * Custom error classes for common error types
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class EntityNotFoundError extends Error {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} with ID ${id} not found` : `${entity} not found`);
    this.name = 'EntityNotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class BadGatewayError extends Error {
  constructor(message: string = 'Bad gateway') {
    super(message);
    this.name = 'BadGatewayError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string = 'Service unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
