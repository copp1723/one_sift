// jest.setup.js - Global Jest setup and configuration
const { jest } = require('@jest/globals');

// Extend the Jest timeout for async tests
jest.setTimeout(10000);

// Mock Redis
jest.mock('ioredis', () => {
  const redisMock = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockImplementation((key) => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    exists: jest.fn().mockImplementation(() => Promise.resolve(0)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    on: jest.fn(),
    duplicate: jest.fn().mockImplementation(function() { return this; }),
    client: jest.fn().mockImplementation(function() { return this; }),
  };

  return jest.fn(() => redisMock);
});

// Mock database client
jest.mock('../src/db/index.js', () => {
  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockReturnThis(),
    transaction: jest.fn().mockImplementation((cb) => cb(mockDb)),
    fn: {
      count: jest.fn().mockReturnValue({ count: jest.fn() }),
    },
    sql: jest.fn().mockImplementation((strings, ...values) => ({
      strings,
      values,
    })),
  };

  return {
    db: mockDb,
    client: {
      connect: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      unsafe: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock config
jest.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    API_KEY_SECRET: 'test-secret',
    MAILGUN_API_KEY: 'test-key',
    MAILGUN_DOMAIN: 'test.domain.com',
    MAILGUN_WEBHOOK_SIGNING_KEY: 'test-signing-key',
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgres://user:password@localhost:5432/testdb',
    ALLOWED_ORIGINS: ['http://localhost:3000'],
  }
}));

// Mock Fastify
jest.mock('fastify', () => {
  const mockReply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    headers: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis(),
    sent: false,
    raw: { writeHead: jest.fn(), end: jest.fn() },
    log: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
  };

  const mockRequest = {
    log: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
    body: {},
    query: {},
    params: {},
    headers: {},
    id: 'test-request-id',
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    ips: ['127.0.0.1'],
    protocol: 'http',
    hostname: 'localhost',
    raw: { url: '/test' },
  };

  const mockFastify = {
    register: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    addHook: jest.fn(),
    setErrorHandler: jest.fn(),
    setNotFoundHandler: jest.fn(),
    listen: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    log: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
  };

  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(mockFastify),
    mockFastify,
    mockRequest,
    mockReply,
  };
});

// Global test utilities
global.createMockRequest = (overrides = {}) => {
  return {
    log: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
    body: {},
    query: {},
    params: {},
    headers: {},
    id: 'test-request-id',
    url: '/test',
    method: 'GET',
    ...overrides,
  };
};

global.createMockReply = (overrides = {}) => {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    headers: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis(),
    sent: false,
    ...overrides,
  };
};

// Custom Jest matchers
expect.extend({
  toBeValidUuid(received) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidPattern.test(received);
    return {
      pass,
      message: () => `Expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
    };
  },
  
  toHaveSuccessResponse(received) {
    const pass = received.success === true && received.data !== undefined;
    return {
      pass,
      message: () => `Expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to be a success response`,
    };
  },
  
  toHaveErrorResponse(received) {
    const pass = received.success === false && received.error !== undefined;
    return {
      pass,
      message: () => `Expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to be an error response`,
    };
  },
});

// Global beforeAll/afterAll hooks
beforeAll(() => {
  // Set environment variables for tests
  process.env.NODE_ENV = 'test';
  
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterAll(() => {
  // Clean up any global state
  jest.restoreAllMocks();
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
