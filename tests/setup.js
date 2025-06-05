const { config: loadEnv } = require('dotenv');

// Load test environment variables
loadEnv({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock Redis for tests
jest.mock('../src/config/redis.js', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);
