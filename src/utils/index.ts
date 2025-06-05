/**
 * Utils Module - Centralized export of all utility functions
 * 
 * This file provides a clean interface for importing utility functions
 * from a single location, simplifying imports across the codebase.
 */

// Response utilities
export {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendValidationError,
  sendConflict,
  sendForbidden,
  sendUnauthorized,
  sendServerError,
  sendPaginated,
  sendNoContent,
  sendTooManyRequests,
  sendBadGateway,
  sendServiceUnavailable,
  type ApiResponse,
  type PaginationMeta,
  type ErrorResponseOptions
} from './response.js';

// Database utilities
export {
  findById,
  findByField,
  exists,
  notExists,
  verifyCustomer,
  verifyActiveCustomer,
  buildPaginationQuery,
  countRecords,
  buildFilteredQuery,
  transaction,
  EntityNotFoundError,
  type FindOptions
} from './database.js';

// Validation utilities
export {
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
} from './validation.js';

// Async handler utilities
export {
  asyncHandler,
  asyncHandlers,
  registerAsyncRoutes,
  withRetry,
  withTransaction,
  withDatabaseRetry,
  withConcurrency,
  withTimeout,
  createLoggerMiddleware,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  TimeoutError,
  BadGatewayError,
  ServiceUnavailableError,
  type AsyncRouteOptions
} from './async-handler.js';

// JWT utilities
export {
  signJwt,
  verifyJwt
} from './jwt.js';

// Slug utilities
export {
  sanitizeSlug,
  schemaNameFromSlug
} from './slug.js';
