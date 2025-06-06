/**
 * Response Utilities Tests
 */

import { 
  sendSuccess, 
  sendError, 
  sendNotFound, 
  sendConflict, 
  sendValidationError,
  sendInternalError,
  sendCreated,
  sendPaginated,
  calculatePagination
} from '../../../src/utils/response.js';

// Mock Fastify reply
const mockReply = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis()
};

// Mock logger
jest.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn()
  }
}));

describe('Response Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendSuccess', () => {
    it('should send basic success response', () => {
      const data = { id: '1', name: 'Test' };
      
      sendSuccess(mockReply as any, data);
      
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data
      });
    });

    it('should send success response with custom status and message', () => {
      const data = { id: '1' };
      
      sendSuccess(mockReply as any, data, {
        statusCode: 201,
        message: 'Created successfully'
      });
      
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Created successfully'
      });
    });

    it('should send success response with pagination meta', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const meta = { page: 1, limit: 10, total: 2, totalPages: 1 };
      
      sendSuccess(mockReply as any, data, { meta });
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        meta
      });
    });
  });

  describe('sendError', () => {
    it('should send basic error response', () => {
      sendError(mockReply as any, 'TestError', 'Test error message');
      
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'TestError',
        message: 'Test error message',
        timestamp: expect.any(String)
      });
    });

    it('should send error response with custom status and request ID', () => {
      sendError(mockReply as any, 'ValidationError', 'Invalid input', {
        statusCode: 400,
        requestId: 'req-123'
      });
      
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'ValidationError',
        message: 'Invalid input',
        timestamp: expect.any(String),
        requestId: 'req-123'
      });
    });

    it('should include details in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      sendError(mockReply as any, 'TestError', 'Test message', {
        details: { field: 'email' }
      });
      
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { field: 'email' }
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include details in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      sendError(mockReply as any, 'TestError', 'Test message', {
        details: { field: 'email' }
      });
      
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.not.objectContaining({
          details: expect.anything()
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendNotFound', () => {
    it('should send 404 response with default message', () => {
      sendNotFound(mockReply as any);
      
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Resource not found',
        timestamp: expect.any(String)
      });
    });

    it('should send 404 response with custom resource name', () => {
      sendNotFound(mockReply as any, 'Customer', 'req-123');
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Not Found',
        message: 'Customer not found',
        timestamp: expect.any(String),
        requestId: 'req-123'
      });
    });
  });

  describe('sendConflict', () => {
    it('should send 409 response', () => {
      sendConflict(mockReply as any, 'Resource already exists');
      
      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message: 'Resource already exists',
        timestamp: expect.any(String)
      });
    });
  });

  describe('sendValidationError', () => {
    it('should send 400 response without field', () => {
      sendValidationError(mockReply as any, 'Invalid data');
      
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message: 'Invalid data',
        timestamp: expect.any(String)
      });
    });

    it('should send 400 response with field details', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      sendValidationError(mockReply as any, 'Email is required', 'email');
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation Error',
        message: 'Email is required',
        timestamp: expect.any(String),
        details: { field: 'email' }
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendInternalError', () => {
    it('should send 500 response with default message', () => {
      sendInternalError(mockReply as any);
      
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        timestamp: expect.any(String)
      });
    });

    it('should send 500 response with custom message', () => {
      sendInternalError(mockReply as any, 'Database connection failed');
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Internal Server Error',
        message: 'Database connection failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('sendCreated', () => {
    it('should send 201 response', () => {
      const data = { id: '1', name: 'New Item' };
      
      sendCreated(mockReply as any, data);
      
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Resource created successfully'
      });
    });

    it('should send 201 response with custom message', () => {
      const data = { id: '1' };
      
      sendCreated(mockReply as any, data, 'Customer created');
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Customer created'
      });
    });
  });

  describe('sendPaginated', () => {
    it('should send paginated response', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };
      
      sendPaginated(mockReply as any, data, pagination);
      
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        data,
        meta: pagination
      });
    });
  });

  describe('calculatePagination', () => {
    it('should calculate pagination correctly', () => {
      const result = calculatePagination(2, 10, 25);
      
      expect(result).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      });
    });

    it('should handle edge cases', () => {
      const result = calculatePagination(0, 0, -5);
      
      expect(result).toEqual({
        page: 1,
        limit: 1,
        total: 0,
        totalPages: 1
      });
    });

    it('should calculate single page correctly', () => {
      const result = calculatePagination(1, 10, 5);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1
      });
    });
  });
});
