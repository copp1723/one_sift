export default {
  // Use ESM for Jest with TypeScript
  preset: 'ts-jest/presets/default-esm',
  
  // Test environment
  testEnvironment: 'node',
  
  // File extensions for imports
  extensionsToTreatAsEsm: ['.ts'],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  
  // Module name mapper for path resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    '!src/utils/index.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds for utility functions
  coverageThreshold: {
    'src/utils/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Verbose output
  verbose: true,
  
  // Global setup
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Ignore paths
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ]
}
