/**
 * Response Utilities
 * 
 * Standardized response formatting for API endpoints.
 * Eliminates duplication and ensures consistent response structure.
 */

import { FastifyReply } from 'fastify';
import { logger } from './logger.js';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  requestId?: string;
  timestamp?: string;
  details?: Record<string, any>;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Send a standardized success response
 * 
 * @param reply - Fastify reply object
 * @param data - Response data
 * @param options - Additional options
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  options: {
    statusCode?: number;
    message?: string;
    meta?: PaginationMeta;
  } = {}
): void {
  const { statusCode = 200, message, meta } = options;

  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta })
  };

  reply.status(statusCode).send(response);
}

/**
 * Send a standardized error response
 * 
 * @param reply - Fastify reply object
 * @param error - Error type/code
 * @param message - Error message
 * @param options - Additional options
 */
export function sendError(
  reply: FastifyReply,
  error: string,
  message: string,
  options: {
    statusCode?: number;
    requestId?: string;
    details?: Record<string, any>;
    logError?: boolean;
  } = {}
): void {
  const { 
    statusCode = 500, 
    requestId, 
    details, 
    logError = true 
  } = options;

  const response: ErrorResponse = {
    success: false,
    error,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
    ...(details && process.env.NODE_ENV !== 'production' && { details })
  };

  // Log error if requested
  if (logError) {
    logger.error(`API Error: ${error}`, {
      message,
      statusCode,
      requestId,
      details
    });
  }

  reply.status(statusCode).send(response);
}

/**
 * Send a 404 Not Found response
 * 
 * @param reply - Fastify reply object
 * @param resource - Resource type that was not found
 * @param requestId - Optional request ID
 */
export function sendNotFound(
  reply: FastifyReply,
  resource: string = 'Resource',
  requestId?: string
): void {
  sendError(
    reply,
    'Not Found',
    `${resource} not found`,
    {
      statusCode: 404,
      requestId,
      logError: false // 404s are usually not errors worth logging
    }
  );
}

/**
 * Send a 409 Conflict response
 * 
 * @param reply - Fastify reply object
 * @param message - Conflict message
 * @param requestId - Optional request ID
 */
export function sendConflict(
  reply: FastifyReply,
  message: string,
  requestId?: string
): void {
  sendError(
    reply,
    'Conflict',
    message,
    {
      statusCode: 409,
      requestId,
      logError: false // Conflicts are usually operational, not system errors
    }
  );
}

/**
 * Send a 400 Bad Request response
 * 
 * @param reply - Fastify reply object
 * @param message - Validation error message
 * @param field - Optional field that failed validation
 * @param requestId - Optional request ID
 */
export function sendValidationError(
  reply: FastifyReply,
  message: string,
  field?: string,
  requestId?: string
): void {
  sendError(
    reply,
    'Validation Error',
    message,
    {
      statusCode: 400,
      requestId,
      details: field ? { field } : undefined,
      logError: false // Validation errors are user errors, not system errors
    }
  );
}

/**
 * Send a 500 Internal Server Error response
 * 
 * @param reply - Fastify reply object
 * @param message - Error message
 * @param requestId - Optional request ID
 * @param error - Optional error object for logging
 */
export function sendInternalError(
  reply: FastifyReply,
  message: string = 'An unexpected error occurred',
  requestId?: string,
  error?: Error
): void {
  // Log the actual error for debugging
  if (error) {
    logger.error('Internal server error', {
      message: error.message,
      stack: error.stack,
      requestId
    });
  }

  sendError(
    reply,
    'Internal Server Error',
    message,
    {
      statusCode: 500,
      requestId,
      logError: !error // Only log if we haven't already logged the error
    }
  );
}

/**
 * Send a 201 Created response
 * 
 * @param reply - Fastify reply object
 * @param data - Created resource data
 * @param message - Optional success message
 */
export function sendCreated<T>(
  reply: FastifyReply,
  data: T,
  message?: string
): void {
  sendSuccess(reply, data, {
    statusCode: 201,
    message: message || 'Resource created successfully'
  });
}

/**
 * Send a paginated response
 * 
 * @param reply - Fastify reply object
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param message - Optional message
 */
export function sendPaginated<T>(
  reply: FastifyReply,
  data: T[],
  pagination: PaginationMeta,
  message?: string
): void {
  sendSuccess(reply, data, {
    message,
    meta: pagination
  });
}

/**
 * Calculate pagination metadata
 * 
 * @param page - Current page (1-based)
 * @param limit - Items per page
 * @param total - Total number of items
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    total: Math.max(0, total),
    totalPages: Math.max(1, totalPages)
  };
}
