import { FastifyReply } from 'fastify';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationMeta;
  requestId?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Error response details
 */
export interface ErrorResponseOptions {
  /** HTTP status code */
  statusCode?: number;
  /** Error type/name */
  error?: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: Record<string, any>;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * Send a success response
 * 
 * @param reply - Fastify reply object
 * @param data - Response data
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendSuccess(reply, customer);
 * ```
 */
export function sendSuccess<T = any>(
  reply: FastifyReply, 
  data: T,
  message?: string,
  statusCode: number = 200
): FastifyReply {
  const response: ApiResponse<T> = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  return reply.status(statusCode).send(response);
}

/**
 * Send a created response (201 Created)
 * 
 * @param reply - Fastify reply object
 * @param data - Created entity data
 * @param message - Optional success message
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendCreated(reply, newCustomer, 'Customer created successfully');
 * ```
 */
export function sendCreated<T = any>(
  reply: FastifyReply,
  data: T,
  message: string = 'Resource created successfully'
): FastifyReply {
  return sendSuccess(reply, data, message, 201);
}

/**
 * Send an error response
 * 
 * @param reply - Fastify reply object
 * @param options - Error response options
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendError(reply, {
 *   statusCode: 400,
 *   error: 'Bad Request',
 *   message: 'Invalid input data'
 * });
 * ```
 */
export function sendError(
  reply: FastifyReply,
  options: ErrorResponseOptions
): FastifyReply {
  const { 
    statusCode = 500, 
    error = 'Internal Server Error',
    message,
    details,
    requestId
  } = options;
  
  const response: ApiResponse = {
    success: false,
    error,
    message
  };
  
  if (details) {
    response.data = details;
  }
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  return reply.status(statusCode).send(response);
}

/**
 * Send a not found error response
 * 
 * @param reply - Fastify reply object
 * @param entity - Entity type that was not found
 * @param id - ID or identifier that was searched for
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendNotFound(reply, 'Customer', id);
 * ```
 */
export function sendNotFound(
  reply: FastifyReply,
  entity: string,
  id?: string | number,
  requestId?: string
): FastifyReply {
  const message = id 
    ? `${entity} with ID ${id} not found`
    : `${entity} not found`;
  
  return sendError(reply, {
    statusCode: 404,
    error: 'Not Found',
    message,
    requestId
  });
}

/**
 * Send a validation error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param details - Validation error details
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendValidationError(reply, 'Invalid input data', {
 *   field: 'email',
 *   issue: 'must be a valid email address'
 * });
 * ```
 */
export function sendValidationError(
  reply: FastifyReply,
  message: string = 'Validation error',
  details?: Record<string, any>,
  requestId?: string
): FastifyReply {
  return sendError(reply, {
    statusCode: 400,
    error: 'Bad Request',
    message,
    details,
    requestId
  });
}

/**
 * Send a conflict error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param details - Optional conflict details
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendConflict(reply, 'Customer with this slug already exists');
 * ```
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
  details?: Record<string, any>,
  requestId?: string
): FastifyReply {
  return sendError(reply, {
    statusCode: 409,
    error: 'Conflict',
    message,
    details,
    requestId
  });
}

/**
 * Send a forbidden error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendForbidden(reply, 'Insufficient permissions');
 * ```
 */
export function sendForbidden(
  reply: FastifyReply,
  message: string = 'Access forbidden',
  requestId?: string
): FastifyReply {
  return sendError(reply, {
    statusCode: 403,
    error: 'Forbidden',
    message,
    requestId
  });
}

/**
 * Send an unauthorized error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendUnauthorized(reply, 'Authentication required');
 * ```
 */
export function sendUnauthorized(
  reply: FastifyReply,
  message: string = 'Unauthorized',
  requestId?: string
): FastifyReply {
  return sendError(reply, {
    statusCode: 401,
    error: 'Unauthorized',
    message,
    requestId
  });
}

/**
 * Send a server error response
 * 
 * @param reply - Fastify reply object
 * @param error - Error object or message
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * try {
 *   // Some operation
 * } catch (error) {
 *   return sendServerError(reply, error);
 * }
 * ```
 */
export function sendServerError(
  reply: FastifyReply,
  error: Error | string,
  requestId?: string
): FastifyReply {
  const message = typeof error === 'string' 
    ? error 
    : (error.message || 'An unexpected error occurred');
  
  // In production, don't expose detailed error messages
  const isProduction = process.env.NODE_ENV === 'production';
  const publicMessage = isProduction 
    ? 'An unexpected error occurred' 
    : message;
  
  return sendError(reply, {
    statusCode: 500,
    error: 'Internal Server Error',
    message: publicMessage,
    details: isProduction ? undefined : { 
      originalError: typeof error === 'string' ? error : error.stack 
    },
    requestId
  });
}

/**
 * Send a paginated response
 * 
 * @param reply - Fastify reply object
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param message - Optional success message
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendPaginated(reply, customers, {
 *   total: 100,
 *   page: 1,
 *   limit: 20,
 *   pages: 5
 * });
 * ```
 */
export function sendPaginated<T = any>(
  reply: FastifyReply,
  data: T[],
  pagination: PaginationMeta,
  message?: string
): FastifyReply {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    pagination
  };
  
  if (message) {
    response.message = message;
  }
  
  return reply.send(response);
}

/**
 * Send an empty response (204 No Content)
 * 
 * @param reply - Fastify reply object
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendNoContent(reply);
 * ```
 */
export function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

/**
 * Send a too many requests error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param retryAfter - Seconds until retry is allowed
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendTooManyRequests(reply, 'Rate limit exceeded', 60);
 * ```
 */
export function sendTooManyRequests(
  reply: FastifyReply,
  message: string = 'Too many requests',
  retryAfter?: number,
  requestId?: string
): FastifyReply {
  if (retryAfter) {
    reply.header('Retry-After', String(retryAfter));
  }
  
  return sendError(reply, {
    statusCode: 429,
    error: 'Too Many Requests',
    message,
    requestId
  });
}

/**
 * Send a bad gateway error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendBadGateway(reply, 'External service unavailable');
 * ```
 */
export function sendBadGateway(
  reply: FastifyReply,
  message: string = 'Bad gateway',
  requestId?: string
): FastifyReply {
  return sendError(reply, {
    statusCode: 502,
    error: 'Bad Gateway',
    message,
    requestId
  });
}

/**
 * Send a service unavailable error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param retryAfter - Seconds until retry is allowed
 * @param requestId - Optional request ID for tracking
 * @returns The Fastify reply object
 * @example
 * ```ts
 * return sendServiceUnavailable(reply, 'Service temporarily unavailable', 60);
 * ```
 */
export function sendServiceUnavailable(
  reply: FastifyReply,
  message: string = 'Service unavailable',
  retryAfter?: number,
  requestId?: string
): FastifyReply {
  if (retryAfter) {
    reply.header('Retry-After', String(retryAfter));
  }
  
  return sendError(reply, {
    statusCode: 503,
    error: 'Service Unavailable',
    message,
    requestId
  });
}
