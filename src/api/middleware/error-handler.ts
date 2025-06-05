/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { 
  AppError, 
  isAppError, 
  createErrorFromUnknown, 
  formatErrorResponse,
  ErrorCode 
} from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface ErrorHandlerOptions {
  enableStackTrace?: boolean;
  logErrors?: boolean;
}

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError | Error | AppError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Create AppError from unknown error type
  const appError = isAppError(error) ? error : createErrorFromUnknown(error);
  
  // Log error with context
  const logContext = {
    requestId: request.id,
    method: request.method,
    path: request.url,
    error: error as Error,
    userId: (request as any).user?.id,
    customerId: request.params && (request.params as any).customerId
  };

  // Log based on error type
  if (appError.isOperational) {
    logger.warn(`Operational error: ${appError.message}`, logContext);
  } else {
    logger.error(`System error: ${appError.message}`, logContext);
  }

  // Set appropriate headers
  if (appError.code === ErrorCode.RATE_LIMIT && appError.details?.retryAfter) {
    reply.header('Retry-After', appError.details.retryAfter.toString());
  }

  // Format and send error response
  const response = formatErrorResponse(appError, request.id);
  
  reply
    .status(appError.statusCode)
    .send(response);
}

/**
 * Not found handler
 */
export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const error = new AppError(
    ErrorCode.NOT_FOUND,
    `Route ${request.method} ${request.url} not found`,
    404,
    true
  );

  logger.warn('Route not found', {
    requestId: request.id,
    method: request.method,
    path: request.url
  });

  reply
    .status(404)
    .send(formatErrorResponse(error, request.id));
}

/**
 * Validation error handler
 */
export function validationErrorHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  error: FastifyError
): void {
  logger.warn('Validation error', {
    requestId: request.id,
    method: request.method,
    path: request.url,
    validation: error.validation,
    validationContext: error.validationContext
  });

  // Extract field information from Fastify validation error
  let field: string | undefined;
  let message = 'Validation failed';
  
  if (error.validation && error.validation.length > 0) {
    const firstError = error.validation[0];
    field = String(firstError.instancePath?.replace('/', '') || firstError.params?.missingProperty || '');
    message = firstError.message || message;
  }

  const appError = new AppError(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    true,
    { 
      field,
      validation: error.validation,
      validationContext: error.validationContext 
    }
  );

  reply
    .status(400)
    .send(formatErrorResponse(appError, request.id));
}

/**
 * Async error boundary for catching unhandled promise rejections
 */
export function asyncErrorBoundary(
  fn: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      // Let the global error handler handle it
      throw error;
    }
  };
}

/**
 * Register error handlers with Fastify instance
 */
export function registerErrorHandlers(fastify: any): void {
  // Set custom error handler
  fastify.setErrorHandler(errorHandler);
  
  // Set not found handler
  fastify.setNotFoundHandler(notFoundHandler);
  
  // Handle validation errors specifically
  fastify.setSchemaErrorFormatter((errors: any, dataVar: string) => {
    return new Error(`Validation failed for ${dataVar}: ${JSON.stringify(errors)}`);
  });

  // Log server errors
  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    logger.error('Request error hook triggered', {
      requestId: request.id,
      method: request.method,
      path: request.url,
      error
    });
  });

  // Add request logging
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = reply.getResponseTime();
    logger.logRequest(request, reply, responseTime);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', { error });
    // Exit after logging
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      error: reason instanceof Error ? reason : new Error(String(reason))
    });
  });
}