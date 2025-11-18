/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Cleanup after all tests
afterAll(async () => {
  // Close any open connections
  await new Promise((resolve) => setTimeout(resolve, 500));
});
