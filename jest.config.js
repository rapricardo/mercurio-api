module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['html', 'lcov', 'text-summary'],
  moduleNameMapping: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  collectCoverageFrom: [
    'common/**/*.ts',
    'events/**/*.ts',
    'scripts/**/*.ts',
    '*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/dto/*.ts',
    '!**/types/*.ts',
    '!main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
};