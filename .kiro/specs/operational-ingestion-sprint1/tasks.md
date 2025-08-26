# Implementation Plan

- [x] 1. Setup infrastructure and development environment
  - [x] Create docker-compose.yml for local development with PostgreSQL and API services
  - [x] Create Makefile with targets for up, down, seed, and logs commands
  - [x] Update .env.example with complete configuration including new environment variables
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 2. Implement database schema enhancements for deduplication
  - [x] Create Prisma migration for event_deduplication table with tenant_id and event_id composite key
  - [x] Add optional eventId field to existing Event model for client-provided event IDs
  - [x] Add database index for (tenant_id, event_id) deduplication queries
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Create enhanced provisioning system
  - [x] Implement scripts/provision-tenant.ts that extends existing seed.ts functionality
  - [x] Add command-line parameter support for tenant name, workspace name, and API key configuration
  - [x] Create npm script command for parametrized tenant provisioning
  - [x] Add validation for duplicate tenant names and proper error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. Implement payload validation enhancements
  - [x] Update EventsController to enforce 256KB payload size limit (reduced from 1MB)
  - [x] Update batch endpoint to enforce 50 events maximum (reduced from 1000)
  - [x] Add X-Event-Schema-Version header extraction and validation logic
  - [x] Implement schema version persistence with fallback to default value
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 5. Build deduplication service
  - [x] Create DeduplicationService class with checkDuplicate and markProcessed methods
  - [x] Implement database operations for event_deduplication table using Prisma
  - [x] Add deduplication logic to EventProcessorService for track events
  - [x] Handle optional event_id parameter in track and batch endpoints
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Enhance structured logging system
  - [x] Create StructuredLogger service with request correlation ID (curto, base36 64-bit; sem UUID)
  - [x] Implement log context with tenant, workspace, and event information
  - [x] Add structured logging to all event processing operations
  - [x] Include request correlation IDs in API responses for traceability
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Update API endpoints for new requirements
  - [x] Modify track endpoint to accept optional event_id in request body
  - [x] Update batch endpoint to handle event_id array for deduplication
  - [x] Enhance identify endpoint with improved validation and logging
  - [x] Add proper error responses with detailed validation messages
  - _Requirements: 2.1, 2.2, 2.6, 3.1, 3.2_

- [x] 8. Implement comprehensive health check system
  - [x] Enhance existing health controller with database connectivity checks
  - [x] Add API service status verification and dependency health monitoring
  - [x] Include response time metrics and system status information
  - [x] Ensure health endpoint returns proper HTTP status codes and JSON responses
  - _Requirements: 4.2, 4.3_

- [x] 9. Create API documentation
  - [x] Write docs/api/ingestion.md with practical examples for track, batch, and identify endpoints
  - [x] Document required and optional headers including X-Event-Schema-Version
  - [x] Include payload format specifications with validation rules and size limits
  - [x] Add error code documentation with scenarios and troubleshooting solutions
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Write comprehensive test suite
  - [x] Create unit tests for provisioning script with parameter validation and error handling
  - [x] Implement validation layer tests for payload size, batch size, and schema version handling
  - [x] Add deduplication service tests for duplicate detection and concurrent processing
  - [x] Write integration tests for all API endpoints with tenant isolation verification
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Performance optimization and monitoring
  - [x] Implement database connection pooling configuration for Docker environment
  - [x] Add API key caching for frequently used keys with TTL-based invalidation
  - [x] Create performance monitoring for p50 latency requirements under 50ms
  - [x] Add metrics collection for event processing rates and error tracking
  - _Requirements: 7.4, 5.1, 5.2_

- [x] 12. Final integration and end-to-end testing
  - [x] Test complete flow from tenant provisioning through event ingestion
  - [x] Validate tenant isolation with multiple tenants and workspaces
  - [x] Verify 95% success rate requirement with load testing
  - [x] Test SDK integration with real API endpoints in staging environment
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
