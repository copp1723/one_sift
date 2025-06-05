/**
 * Standardized Error Handling Utilities
 * Provides custom error classes and error handling helpers
 */

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  stack?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    isOperational = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack })
    };
  }
}

/**
 * Specific error classes for common scenarios
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      true,
      { field, value }
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      true,
      { resource, identifier }
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(ErrorCode.UNAUTHORIZED, message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', reason?: string) {
    super(ErrorCode.FORBIDDEN, message, 403, true, { reason });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, conflictingField?: string) {
    super(ErrorCode.CONFLICT, message, 409, true, { conflictingField });
  }
}

export class RateLimitError extends AppError {
  constructor(limit: number, window: string, retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT,
      `Rate limit exceeded: ${limit} requests per ${window}`,
      429,
      true,
      { limit, window, retryAfter }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, query?: string, originalError?: Error) {
    super(
      ErrorCode.DATABASE_ERROR,
      message,
      500,
      false,
      { 
        query: process.env.NODE_ENV !== 'production' ? query : undefined,
        originalError: originalError?.message 
      }
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, originalError?: Error) {
    super(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service error (${service}): ${message}`,
      502,
      false,
      { service, originalError: originalError?.message }
    );
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, missingConfig?: string[]) {
    super(
      ErrorCode.CONFIGURATION_ERROR,
      message,
      500,
      false,
      { missingConfig }
    );
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Create error from unknown type
 */
export function createErrorFromUnknown(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    // Check for specific database errors
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      return new ConflictError('Resource already exists');
    }
    
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      return new ValidationError('Invalid reference');
    }
    
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      500,
      false
    );
  }
  
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    500,
    false
  );
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: AppError, requestId?: string): Record<string, any> {
  const response: Record<string, any> = {
    error: error.code,
    message: error.message,
    timestamp: error.timestamp
  };
  
  if (requestId) {
    response.requestId = requestId;
  }
  
  if (error.details && process.env.NODE_ENV !== 'production') {
    response.details = error.details;
  }
  
  if (error.code === ErrorCode.VALIDATION_ERROR && error.details?.field) {
    response.field = error.details.field;
  }
  
  if (error.code === ErrorCode.RATE_LIMIT && error.details?.retryAfter) {
    response.retryAfter = error.details.retryAfter;
  }
  
  return response;
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw createErrorFromUnknown(error);
    }
  }) as T;
}