export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { 
      presets: ['@babel/preset-env'],
      plugins: [
        '@babel/plugin-proposal-private-methods',
        '@babel/plugin-proposal-class-properties'
      ]
    }]
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/js/CircuitBreaker/tests/**/*.test.js',
    '**/js/RateLimiter/tests/**/*.test.js',
    '**/js/Validation/tests/**/*.test.js',
    '**/js/Mutex/tests/**/*.test.js',
    '**/js/Logger/tests/**/*.test.js',
    '**/js/Logger/Buffer/tests/**/*.test.js',
    '**/js/Logger/Core/tests/**/*.test.js',
    '**/js/Logger/Metrics/tests/**/*.test.js',
    '**/js/Logger/Worker/tests/**/*.test.js',
    '**/js/errors/tests/**/*.test.js',
    '**/js/cache/tests/**/*.test.js',
    '**/js/ui/tests/**/*.test.js',
    '**/js/config/tests/**/*.test.js'

  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  testEnvironmentOptions: {
    url: 'http://localhost',
    referrer: 'http://localhost',
    userAgent: 'jest',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  transformIgnorePatterns: [
    '/node_modules/(?!lz-string|@babel)'
  ],
  verbose: true,
  testTimeout: 10000
};
