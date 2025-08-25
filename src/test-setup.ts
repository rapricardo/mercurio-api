// Global test setup
import { execSync } from 'child_process';

// Ensure test database exists and is migrated before running tests
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://mercurio:mercurio_dev_password@localhost:5432/mercurio_test';
  
  // Run database migrations for test database
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
  } catch (error) {
    console.warn('Database migration failed - this might be expected if database is already up to date');
  }
}, 60000);

// Global test teardown
afterAll(async () => {
  // Cleanup can be added here if needed
});

// Increase timeout for integration tests
jest.setTimeout(30000);