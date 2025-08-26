# Implementation Plan

- [x] 1. Set up PII encryption infrastructure
  - [x] Create encryption service with AES-GCM and HMAC-SHA256 implementations
  - [x] Implement key management with environment variable configuration
  - [x] Add database migration for key version tracking columns
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Create core encryption service
  - [x] Implement EncryptionService class with encrypt/decrypt methods for email and phone
  - [x] Add fingerprint generation using HMAC-SHA256 with separate secrets
  - [x] Create key versioning system for rotation support
  - [x] Write comprehensive unit tests for encryption operations
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.2 Add database schema changes for encryption
  - [x] Create migration to add email_key_version and phone_key_version columns to lead table
  - [x] Update Prisma schema to include new encryption-related fields
  - [x] Create database indexes for efficient fingerprint lookups
  - _Requirements: 1.1, 1.2_

- [x] 1.3 Integrate encryption into lead processing
  - [x] Modify lead creation/update logic to use encryption service
  - [x] Update existing plaintext data migration script (if needed)
  - [x] Add validation to ensure encrypted data integrity
  - [x] Write integration tests for encrypted lead operations
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 2. Implement rate limiting system (MVP)
  - [x] Create in-memory token bucket rate limiter per tenant/endpoint
  - [x] Provide optional Redis adapter (enable via config) — cluster/Lua optimization deferred
  - [x] Create rate limiting guard with HTTP 429 and retry-after headers
  - [x] Add basic metrics (hits/violations) and config for tiers
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 2.1 Create rate limiting service core
  - [x] Implement RateLimitService with token bucket algorithm
  - [x] Add configurable limits per tenant tier and endpoint category
  - [x] Create rate limit result types and interfaces
  - [x] Write unit tests for rate limiting logic
  - _Requirements: 2.1, 2.4_

- [x] 2.2 Add Redis-based distributed rate limiting
  - [x] Implement Redis client integration with connection pooling
  - [x] Create Lua scripts for atomic rate limit operations
  - [x] Add Redis health monitoring and failover detection
  - [x] Write integration tests for Redis rate limiting
  - _Requirements: 2.1, 2.2_

- [x] 2.3 Implement in-memory fallback system
  - [x] Create in-memory rate limiter with conservative limits
  - [x] Add automatic fallback when Redis is unavailable
  - [x] Implement cleanup for expired in-memory buckets
  - [x] Write tests for fallback scenarios
  - _Requirements: 2.3_

- [x] 2.4 Create rate limiting middleware
  - [x] Implement NestJS guard for rate limit enforcement
  - [x] Add proper HTTP 429 responses with retry-after headers
  - [x] Integrate with existing tenant context system
  - [x] Add rate limit metrics tracking
  - _Requirements: 2.4, 2.5_

- [ ] 3. Enhance API key caching system
  - Reduce cache TTL to 60 seconds for security
  - Add immediate cache invalidation on key revocation
  - Implement cache warming for high-traffic tenants
  - Add detailed cache metrics and monitoring
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3.1 Update API key cache configuration
  - Modify existing ApiKeyService to use 60-second TTL
  - Add configuration for cache warming and preloading
  - Update cache key structure for better organization
  - Write tests for new cache behavior
  - _Requirements: 3.1, 3.2_

- [ ] 3.2 Implement immediate cache invalidation
  - Add cache invalidation on API key revocation
  - Create cache invalidation service for administrative operations
  - Add cache warming for frequently used keys
  - Write integration tests for cache invalidation scenarios
  - _Requirements: 3.4_

- [ ] 3.3 Add enhanced cache metrics
  - Extend existing cache metrics with hit rates and latency
  - Add cache performance monitoring endpoints
  - Implement cache health checks and alerts
  - Create cache performance dashboard data
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Implement OpenTelemetry tracing (MVP)
  - Set up OpenTelemetry SDK with OTLP exporter
  - Add automatic instrumentation for HTTP and database operations
  - Create custom spans for event processing and encryption
  - Implement configurable sampling rates (1–5%)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4.1 Set up OpenTelemetry infrastructure
  - Install and configure OpenTelemetry SDK packages
  - Create tracing service with span management
  - Add OTLP exporter configuration for Jaeger/collector
  - Write basic tracing functionality tests
  - _Requirements: 4.1, 4.4_

- [ ] 4.2 Add automatic instrumentation
  - Configure auto-instrumentation for HTTP requests and responses
  - Add database query tracing with Prisma integration
  - Implement Redis operation tracing
  - Add trace context propagation between services
  - _Requirements: 4.1, 4.3_

- [ ] 4.3 Create custom business logic spans
  - Add tracing for event processing operations
  - Implement spans for encryption/decryption operations
  - Add tracing for rate limiting decisions
  - Create spans for API key validation flows
  - _Requirements: 4.1, 4.2_

- [ ] 4.4 Implement trace correlation with logs
  - Update MercurioLogger to include trace IDs in log entries
  - Add trace context to structured log output
  - Implement trace sampling configuration
  - Write tests for trace-log correlation
  - _Requirements: 4.3, 4.4_

- [~] 5. Enhance metrics collection system (MVP)
  - [x] Extend existing MetricsService with security and quality metrics
  - [x] Add Prometheus-compatible metrics export
  - [ ] Implement data quality event tracking
  - [x] Create performance monitoring for new components
  - _Requirements: 4.2, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 Extend metrics service with security metrics
  - [x] Add rate limiting metrics (hits, violations, quotas)
  - [x] Implement encryption operation metrics (encrypt/decrypt counts, latency)
  - [x] Add API key cache metrics (hit rates, invalidations)
  - [x] Create security event counters and gauges
  - _Requirements: 4.2, 4.5_

- [ ] 5.2 Implement data quality monitoring
  - Create DataQualityMonitor service for event rejection tracking
  - Add validation failure rate metrics
  - Implement duplicate detection rate monitoring
  - Create schema version usage tracking
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.3 Add Prometheus metrics export
  - [x] Create Prometheus-compatible metrics endpoint
  - [x] Implement proper metric naming and labeling conventions
  - [x] Add metrics for all new components (rate limiting, encryption, tracing)
  - [x] Write tests for metrics export functionality
  - _Requirements: 4.2, 4.5_

- [ ] 5.4 Create performance monitoring dashboard data
  - Add latency percentile tracking for new operations
  - Implement memory usage monitoring for encryption operations
  - Create throughput metrics for rate-limited endpoints
  - Add error rate tracking by category and component
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. Implement data quality monitoring (metrics-only)
  - Emit metrics para rejeições por motivo, taxa de duplicatas, uso de schema version
  - Amostrar logs dos descartes (sem persistência dedicada)
  - Documentar mapa de motivos e taxonomia mínima
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6.1 Create data quality event tracking
  - Implement DataQualityMonitor service with event categorization
  - Add database table for quality event storage
  - Create rejection reason taxonomy and tracking
  - Write unit tests for quality event processing
  - _Requirements: 5.1, 5.2_

- [ ] 6.2 Add event sampling and analysis
  - Implement sampling logic for discarded events
  - Create storage mechanism for sampled event data
  - Add analysis endpoints for quality investigation
  - Write integration tests for sampling functionality
  - _Requirements: 5.2, 5.3_

- [ ] 6.3 Create quality metrics and reporting
  - Implement quality score calculation per tenant
  - Add quality trend analysis over time
  - Create quality report generation endpoints
  - Add quality metrics to main metrics export
  - _Requirements: 5.3, 5.4, 5.5_

- [ ] 7. Set up monitoring dashboards and alerts
  - Create Grafana dashboard configurations
  - Implement alert rules for critical metrics
  - Add health check endpoints for new services
  - Create monitoring documentation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7.1 Create monitoring dashboard configurations
  - Design Grafana dashboards for security metrics
  - Create performance monitoring dashboards
  - Add data quality monitoring visualizations
  - Implement system health overview dashboard
  - _Requirements: 6.1, 6.2_

- [ ] 7.2 Implement alerting rules
  - Create alert rules for p95 latency > 120ms threshold
  - Add alerts for error rates and rate limit violations
  - Implement security event alerting (encryption failures, auth issues)
  - Create data quality degradation alerts
  - _Requirements: 6.2, 6.3, 6.4_

- [ ] 7.3 Add health check endpoints
  - Create health checks for encryption service
  - Add rate limiting service health monitoring
  - Implement tracing service health checks
  - Create comprehensive system health endpoint
  - _Requirements: 6.5, 8.1, 8.2, 8.3_

- [ ] 8. Implement secrets management and documentation
  - Create secure environment variable configuration
  - Implement key rotation procedures
  - Add security documentation and guidelines
  - Create deployment and operations documentation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 8.1 Set up secure configuration management
  - Create environment variable templates for all secrets
  - Implement configuration validation on startup
  - Add secure defaults and configuration examples
  - Write configuration management tests
  - _Requirements: 7.1, 7.3_

- [ ] 8.2 Implement key rotation procedures
  - Create key rotation service with zero-downtime support
  - Add key version management and migration logic
  - Implement automated rotation scheduling (if applicable)
  - Write comprehensive key rotation tests
  - _Requirements: 7.2, 7.3, 7.5_

- [ ] 8.3 Create security and operations documentation
  - Update docs/guidelines/security-privacy.md with new procedures
  - Create key rotation runbook and procedures
  - Add troubleshooting guide for new components
  - Document monitoring and alerting setup
  - _Requirements: 7.2, 7.4_

- [ ] 9. Integration testing and performance validation
  - Create end-to-end tests for complete security flow
  - Add performance tests for encryption overhead
  - Implement load testing for rate limiting
  - Validate p95 latency requirements under load
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9.1 Create comprehensive integration tests
  - Write end-to-end tests for PII encryption through full request lifecycle
  - Add integration tests for rate limiting with Redis failover
  - Create tests for trace/metric/log correlation
  - Implement security flow integration tests
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 9.2 Add performance validation tests
  - Create load tests for encryption operation overhead
  - Add performance tests for rate limiting under concurrent load
  - Implement latency validation tests for p95 < 120ms requirement
  - Create memory usage and resource consumption tests
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 9.3 Validate monitoring and alerting
  - Test alert triggering for all defined conditions
  - Validate dashboard data accuracy and completeness
  - Create monitoring system integration tests
  - Add end-to-end observability pipeline tests
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
