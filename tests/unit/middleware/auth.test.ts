import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../../src/api/middleware/auth.js';
import { UnauthorizedError, ForbiddenError } from '../../../src/utils/errors.js';

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
      id: 'test-request-id',
      url: '/test-path'
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

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(UnauthorizedError);

      expect(mockRequest.user).toBeUndefined();
    });

    it('should reject request with malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123'
      };

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(UnauthorizedError);
    });

    it('should reject request with invalid JWT token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.jwt.token'
      };

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(UnauthorizedError);
    });

    it('should reject expired JWT token', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };

      const token = jwt.sign(payload, 'test-secret-key', { expiresIn: '-1h' }); // Expired 1 hour ago
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(UnauthorizedError);
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

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(UnauthorizedError);
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

    it('should handle TokenExpiredError specifically', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };

      const token = jwt.sign(payload, 'test-secret-key', { expiresIn: '-1s' });
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      const error = await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      ).catch(e => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Token has expired');
    });

    it('should handle JsonWebTokenError specifically', async () => {
      mockRequest.headers = {
        authorization: 'Bearer malformed.jwt.token'
      };

      const error = await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      ).catch(e => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Invalid token signature');
    });

    it('should handle NotBeforeError specifically', async () => {
      const payload = {
        userId: 'user-123',
        tenantId: 'tenant-456'
      };

      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
      const token = jwt.sign(payload, 'test-secret-key', { notBefore: futureTime });
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      const error = await authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      ).catch(e => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Token not active yet');
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

      await expect(authenticateToken(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      )).rejects.toThrow(ForbiddenError);
    });
  });
});
