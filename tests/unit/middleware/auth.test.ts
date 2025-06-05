import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../../src/api/middleware/auth.js';

// Mock the config
jest.mock('../../../src/config/index.js', () => ({
  config: {
    API_KEY_SECRET: 'test-secret-key'
  }
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  // let mockNext: jest.Mock; // Not used in current auth middleware

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    
    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    
    // mockNext = jest.fn(); // Not used in current auth middleware
  });

  describe('authenticateToken', () => {
    it('should authenticate valid JWT token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com'
      };
      
      const token = jwt.sign(payload, 'test-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toEqual(payload);
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Access token required'
      });
      expect(mockRequest.user).toBeUndefined();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123'
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    });

    it('should reject request with invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    });

    it('should reject expired JWT token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };
      
      const token = jwt.sign(payload, 'test-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    });

    it('should reject token signed with wrong secret', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };
      
      const token = jwt.sign(payload, 'wrong-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    });

    it('should handle missing tenantId in token', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com'
        // Missing tenantId
      };
      
      const token = jwt.sign(payload, 'test-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should still work but user.tenantId should be undefined
      expect(mockRequest.user).toEqual(payload);
      expect((mockRequest.user as any)?.tenantId).toBeUndefined();
    });
  });

  describe('tenant isolation', () => {
    it('should allow access when tenantId matches route parameter', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };
      
      const token = jwt.sign(payload, 'test-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockRequest.params = { customerId: 'tenant-456' };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRequest.user).toEqual(payload);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should deny access when tenantId does not match route parameter', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };
      
      const token = jwt.sign(payload, 'test-secret-key');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };
      mockRequest.params = { customerId: 'different-tenant' };

      await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access denied for this resource'
      });
    });
  });
});
