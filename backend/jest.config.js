module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/helpers/',
    '/__tests__/globalTeardown.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Increase timeout for integration tests that hit DB
  testTimeout: 30000,
  // Single worker avoids DB pool teardown races across test files
  maxWorkers: 1,
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  // Integration tests use a shared PG pool; avoid hanging on open handles
  forceExit: true,
};