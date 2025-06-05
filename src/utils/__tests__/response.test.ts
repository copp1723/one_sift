import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
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
  ApiResponse,
  PaginationMeta
} from '../response.js';
import { FastifyReply } from 'fastify';

// Mock Fastify reply object
const createMockReply = () => {
  const mockReply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    sent: false
  };
  return mockReply as unknown as FastifyReply;
};

describe('Response Utilities', () => {
  let mockReply: FastifyReply;

  beforeEach(() => {
    mockReply = createMockReply();
    jest.clearAllMocks();
  });

  describe('sendSuccess', () => {
    test('should send a success response with status 200', () => {
      const data = { id: '123', name: 'Test' };
      sendSuccess(mockReply, data);
      
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data
      });
    });

    test('should include message when provided', () => {
      const data = { id: '123' };
      const message = 'Operation successful';
      sendSuccess(mockReply, data, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
    });

    test('should use custom status code when provided', () => {
      const data = { id: '123' };
      sendSuccess(mockReply, data, undefined, 202);
      
      expect(mockReply.status).toHaveBeenCalledWith(202);
    });

    test('should handle null data', () => {
      sendSuccess(mockReply, null);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: null
      });
    });

    test('should handle empty objects', () => {
      sendSuccess(mockReply, {});
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data: {}
      });
    });
  });

  describe('sendCreated', () => {
    test('should send a created response with status 201', () => {
      const data = { id: '123', name: 'Test' };
      sendCreated(mockReply, data);
      
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Resource created successfully'
      });
    });

    test('should use custom message when provided', () => {
      const data = { id: '123' };
      const message = 'Customer created successfully';
      sendCreated(mockReply, data, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
    });
  });

  describe('sendError', () => {
    test('should send an error response with default status 500', () => {
      sendError(mockReply, {
        message: 'Something went wrong'
      });
      
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Something went wrong'
      });
    });

    test('should use custom status code and error type', () => {
      sendError(mockReply, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid input'
      });
      
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Invalid input'
      });
    });

    test('should include details when provided', () => {
      const details = { field: 'email', issue: 'Invalid format' };
      sendError(mockReply, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details
      });
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Validation failed',
        data: details
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendError(mockReply, {
        message: 'Error occurred',
        requestId
      });
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Error occurred',
        requestId
      });
    });
  });

  describe('sendNotFound', () => {
    test('should send a not found response with status 404', () => {
      sendNotFound(mockReply, 'Customer', '123');
      
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Customer with ID 123 not found'
      });
    });

    test('should handle missing ID parameter', () => {
      sendNotFound(mockReply, 'Resource');
      
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Resource not found'
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendNotFound(mockReply, 'Customer', '123', requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Customer with ID 123 not found',
        requestId
      });
    });

    test('should handle numeric IDs', () => {
      sendNotFound(mockReply, 'Product', 456);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Product with ID 456 not found'
      });
    });
  });

  describe('sendValidationError', () => {
    test('should send a validation error with status 400', () => {
      sendValidationError(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Validation error'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'Invalid input data';
      sendValidationError(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message
      });
    });

    test('should include validation details when provided', () => {
      const details = {
        fields: [
          { name: 'email', error: 'Invalid format' },
          { name: 'password', error: 'Too short' }
        ]
      };
      sendValidationError(mockReply, 'Validation failed', details);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Validation failed',
        data: details
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendValidationError(mockReply, 'Validation failed', undefined, requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Validation failed',
        requestId
      });
    });
  });

  describe('sendConflict', () => {
    test('should send a conflict error with status 409', () => {
      const message = 'Resource already exists';
      sendConflict(mockReply, message);
      
      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message
      });
    });

    test('should include details when provided', () => {
      const message = 'Customer with this email already exists';
      const details = { email: 'test@example.com' };
      sendConflict(mockReply, message, details);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message,
        data: details
      });
    });

    test('should include requestId when provided', () => {
      const message = 'Resource already exists';
      const requestId = 'req-123';
      sendConflict(mockReply, message, undefined, requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message,
        requestId
      });
    });
  });

  describe('sendForbidden', () => {
    test('should send a forbidden error with status 403', () => {
      sendForbidden(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'Access forbidden'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'Insufficient permissions';
      sendForbidden(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendForbidden(mockReply, 'Access denied', requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        message: 'Access denied',
        requestId
      });
    });
  });

  describe('sendUnauthorized', () => {
    test('should send an unauthorized error with status 401', () => {
      sendUnauthorized(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Unauthorized'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'Authentication required';
      sendUnauthorized(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendUnauthorized(mockReply, 'Invalid token', requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token',
        requestId
      });
    });
  });

  describe('sendServerError', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    
    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should send a server error with status 500', () => {
      const error = new Error('Database connection failed');
      sendServerError(mockReply, error);
      
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Database connection failed',
        details: { originalError: expect.stringContaining('Database connection failed') }
      });
    });

    test('should handle string error messages', () => {
      const errorMessage = 'Something went wrong';
      sendServerError(mockReply, errorMessage);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: errorMessage,
        details: { originalError: errorMessage }
      });
    });

    test('should include requestId when provided', () => {
      const error = new Error('Database error');
      const requestId = 'req-123';
      sendServerError(mockReply, error, requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Database error',
        details: { originalError: expect.stringContaining('Database error') },
        requestId
      });
    });

    test('should sanitize error details in production environment', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Sensitive database error');
      sendServerError(mockReply, error);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
      // Ensure details are not included in production
      expect(mockReply.send).not.toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.anything()
        })
      );
    });
  });

  describe('sendPaginated', () => {
    test('should send a paginated response', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination: PaginationMeta = {
        total: 10,
        page: 1,
        limit: 2,
        pages: 5
      };
      
      sendPaginated(mockReply, data, pagination);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        pagination
      });
    });

    test('should include message when provided', () => {
      const data = [{ id: '1' }];
      const pagination: PaginationMeta = {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1
      };
      const message = 'Results retrieved successfully';
      
      sendPaginated(mockReply, data, pagination, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        pagination,
        message
      });
    });

    test('should handle empty data array', () => {
      const data: any[] = [];
      const pagination: PaginationMeta = {
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
      };
      
      sendPaginated(mockReply, data, pagination);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        pagination
      });
    });
  });

  describe('sendNoContent', () => {
    test('should send a no content response with status 204', () => {
      sendNoContent(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });

  describe('sendTooManyRequests', () => {
    test('should send a too many requests error with status 429', () => {
      sendTooManyRequests(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message: 'Too many requests'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'Rate limit exceeded';
      sendTooManyRequests(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message
      });
    });

    test('should set Retry-After header when provided', () => {
      const retryAfter = 60;
      sendTooManyRequests(mockReply, 'Rate limit exceeded', retryAfter);
      
      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', '60');
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendTooManyRequests(mockReply, 'Rate limit exceeded', 30, requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        requestId
      });
    });
  });

  describe('sendBadGateway', () => {
    test('should send a bad gateway error with status 502', () => {
      sendBadGateway(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(502);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Gateway',
        message: 'Bad gateway'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'External service unavailable';
      sendBadGateway(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Gateway',
        message
      });
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendBadGateway(mockReply, 'External API error', requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Gateway',
        message: 'External API error',
        requestId
      });
    });
  });

  describe('sendServiceUnavailable', () => {
    test('should send a service unavailable error with status 503', () => {
      sendServiceUnavailable(mockReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Service Unavailable',
        message: 'Service unavailable'
      });
    });

    test('should use custom message when provided', () => {
      const message = 'System under maintenance';
      sendServiceUnavailable(mockReply, message);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Service Unavailable',
        message
      });
    });

    test('should set Retry-After header when provided', () => {
      const retryAfter = 300;
      sendServiceUnavailable(mockReply, 'Maintenance in progress', retryAfter);
      
      expect(mockReply.header).toHaveBeenCalledWith('Retry-After', '300');
    });

    test('should include requestId when provided', () => {
      const requestId = 'req-123';
      sendServiceUnavailable(mockReply, 'Service temporarily down', 60, requestId);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Service Unavailable',
        message: 'Service temporarily down',
        requestId
      });
    });
  });
});
