import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

/**
 * JWT Utilities using the standard jsonwebtoken library
 * Provides secure JWT signing and verification with proper error handling
 */

export interface JwtOptions {
  expiresIn?: StringValue | number;
  algorithm?: jwt.Algorithm;
  issuer?: string;
  audience?: string | string[];
}

/**
 * Sign a JWT token using the standard jsonwebtoken library
 * @param payload - The payload to include in the token
 * @param secret - The secret key for signing
 * @param options - JWT options including expiration
 * @returns Signed JWT token
 */
export function signJwt(payload: Record<string, any>, secret: string, options: JwtOptions = {}): string {
  const signOptions: jwt.SignOptions = {
    algorithm: options.algorithm || 'HS256'
  };

  if (options.expiresIn !== undefined) {
    signOptions.expiresIn = options.expiresIn;
  }
  if (options.issuer) {
    signOptions.issuer = options.issuer;
  }
  if (options.audience) {
    signOptions.audience = options.audience;
  }

  return jwt.sign(payload, secret, signOptions);
}

/**
 * Verify a JWT token using the standard jsonwebtoken library
 * @param token - The JWT token to verify
 * @param secret - The secret key for verification
 * @param options - Verification options
 * @returns Decoded payload
 * @throws {jwt.TokenExpiredError} When token has expired
 * @throws {jwt.JsonWebTokenError} When token is invalid
 * @throws {jwt.NotBeforeError} When token is not active yet
 */
export function verifyJwt<T = any>(token: string, secret: string, options?: jwt.VerifyOptions): T {
  const verifyOptions: jwt.VerifyOptions = {
    algorithms: ['HS256'],
    ...options
  };

  return jwt.verify(token, secret, verifyOptions) as T;
}

/**
 * Decode a JWT token without verification (for debugging purposes only)
 * @param token - The JWT token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeJwt<T = any>(token: string): T | null {
  return jwt.decode(token) as T | null;
}

// Re-export jsonwebtoken error types for convenience
export const {
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError
} = jwt;
