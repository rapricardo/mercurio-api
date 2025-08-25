# Test Suite Documentation

## Overview

Comprehensive test suite for the Mercurio API Sprint 1 - Ingestão Operacional features, covering all critical functionality with unit tests, integration tests, and end-to-end testing.

## Test Categories

### 1. Unit Tests

#### Provisioning System Tests (`provision-tenant.test.ts`)
- **Parameter Validation**: Empty names, length limits, whitespace handling
- **Duplicate Prevention**: Tenant name uniqueness, case sensitivity
- **Complete Provisioning**: Tenant, workspace, and API key creation
- **Sample Data Generation**: Optional sample data creation and validation
- **API Key Generation**: Unique keys, proper hashing, correct scopes
- **Error Handling**: Database errors, rollback scenarios
- **Structured Output**: Response format validation

#### Payload Validation Tests (`validation.test.ts`)
- **Payload Size Limits**: 256KB limit enforcement for all endpoints
- **Batch Size Limits**: 50 events maximum per batch
- **Schema Version Handling**: Header extraction, invalid version fallback
- **Timestamp Validation**: 5-minute window enforcement
- **Identify Validation**: Email format, required fields
- **Error Response Format**: Structured error messages

#### Deduplication Tests (`deduplication.test.ts`)
- **Duplicate Detection**: Event ID-based deduplication
- **New Event Processing**: Non-duplicate event handling
- **Skip Deduplication**: Behavior when event_id not provided
- **Tenant Isolation**: Cross-tenant deduplication isolation
- **Concurrent Processing**: Race condition handling
- **Batch Deduplication**: Mixed duplicate/new events in batches
- **Error Handling**: Database errors during duplicate checks

### 2. Integration Tests (`integration.test.ts`)

#### Authentication
- Missing API key rejection
- Invalid API key rejection
- Valid Authorization header acceptance
- X-API-Key header support
- Query parameter auth for events (sendBeacon compatibility)

#### Track Event Endpoint
- Successful event tracking
- Event deduplication handling
- Payload size limit enforcement
- Timestamp window validation

#### Batch Events Endpoint
- Successful batch processing
- Batch size limit enforcement
- Mixed success/failure handling

#### Identify Endpoint
- Successful user identification
- Missing identification rejection
- Email format validation

#### Health Check Endpoint
- Healthy status reporting
- Response format validation

#### Tenant Isolation
- Cross-tenant event isolation
- Deduplication isolation between tenants
- Data access prevention across tenants

#### Request Correlation
- X-Request-ID header handling
- Client-provided request ID support

#### Schema Versioning
- Version header processing
- Invalid version fallback

## Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript preset with ts-jest
- 30-second timeout for integration tests
- Coverage thresholds: 80% across all metrics
- Sequential test execution to avoid database conflicts
- Coverage reporting in HTML and LCOV formats

### Test Setup (`test-setup.ts`)
- Automatic test database migration
- Environment variable configuration
- Global timeout settings

### Database Setup
- Isolated test database (`mercurio_test`)
- Automatic cleanup between tests
- Migration deployment before test execution

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:e2e

# Specific test files
npm run test:provision
npm run test:validation
npm run test:deduplication
npm run test:integration
```

### Development
```bash
# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Coverage Goals

- **Functions**: 80% minimum coverage
- **Lines**: 80% minimum coverage
- **Branches**: 80% minimum coverage
- **Statements**: 80% minimum coverage

### Critical Areas Covered
- Event ingestion pipeline (track, batch, identify)
- Deduplication logic with tenant isolation
- Payload validation and size limits
- Authentication and authorization
- Error handling and response formatting
- Health check system
- Request correlation and logging

## Test Data Management

### Test Utilities (`TestUtils`)
- Automated database cleanup between tests
- Tenant/workspace/API key creation helpers
- Sample data generation for complex scenarios
- Tenant isolation verification utilities

### Database Isolation
- Each test runs with clean database state
- Proper cleanup prevents test interference
- Transaction-based cleanup for performance

## Continuous Integration

### Prerequisites
- PostgreSQL test database available
- Environment variables properly configured
- All dependencies installed

### CI Pipeline Integration
```bash
# In CI/CD pipeline
npm ci
npm run prisma:generate
npm run test:coverage
```

### Coverage Reporting
- HTML reports generated in `coverage/` directory
- LCOV format for integration with coverage tools
- Text summary for quick CI feedback

## Best Practices

### Test Structure
- Arrange-Act-Assert pattern
- Clear test descriptions
- Isolated test cases
- Proper mocking for external dependencies

### Database Testing
- Use test database only
- Clean state between tests
- Verify actual database persistence
- Test tenant isolation rigorously

### Error Testing
- Test all error conditions
- Verify error response formats
- Test edge cases and boundary conditions
- Ensure proper error logging

### Integration Testing
- Real HTTP requests to actual endpoints
- Full authentication flow
- Complete request/response cycle
- Database persistence verification

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Ensure PostgreSQL is running
- Check TEST_DATABASE_URL environment variable
- Verify database permissions

**Test Timeout Errors**
- Increase Jest timeout in problematic tests
- Check for database deadlocks
- Ensure proper test cleanup

**Flaky Tests**
- Run tests in sequential mode (`--runInBand`)
- Check for shared state between tests
- Verify proper mocking/cleanup

### Debug Mode
```bash
# Run specific test with detailed output
npm run test -- --testNamePattern="specific test name" --verbose

# Run with Node.js debugging
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

## Future Enhancements

### Performance Testing
- Load testing for batch endpoints
- Concurrent request handling
- Database performance under load

### Security Testing
- API key validation edge cases
- SQL injection prevention
- Cross-tenant data leakage prevention

### Monitoring Integration
- Test structured logging output
- Health check endpoint reliability
- Error tracking integration