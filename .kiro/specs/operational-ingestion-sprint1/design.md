# Design Document

## Overview

O Sprint 1 - Ingestão Operacional estabelece a base para um sistema de ingestão de eventos robusto e escalável. O design foca em implementar funcionalidades essenciais de provisionamento, validação de contratos, confiabilidade básica e observabilidade, utilizando a infraestrutura existente do projeto Mercurio.

O sistema será construído sobre a arquitetura NestJS existente, aproveitando o schema Prisma já definido e os controladores de eventos implementados, mas com melhorias específicas para atender aos requisitos do Sprint 1.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    CLI[Provisioning CLI] --> DB[(PostgreSQL)]
    SDK[JavaScript SDK] --> API[NestJS API]
    API --> AUTH[API Key Guard]
    AUTH --> VALID[Validation Layer]
    VALID --> PROC[Event Processor]
    PROC --> ENRICH[Enrichment Service]
    ENRICH --> DB
    API --> HEALTH[Health Check]
    API --> LOGS[Structured Logging]
```

### Component Interaction

```mermaid
sequenceDiagram
    participant C as Client/SDK
    participant A as API Gateway
    participant V as Validation
    participant D as Deduplication
    participant P as Processor
    participant DB as Database
    participant L as Logger

    C->>A: POST /v1/events/track
    A->>V: Validate payload & headers
    V->>D: Check event_id deduplication
    D->>P: Process event
    P->>DB: Persist event
    P->>L: Log structured event
    DB-->>A: Success response
    A-->>C: 200 OK with event_id
```

## Components and Interfaces

### 1. Provisioning System

**Script: `scripts/provision-tenant.ts`**
- Extends existing `prisma/seed.ts` functionality
- Accepts command-line parameters for tenant/workspace creation
- Generates secure API keys with proper hashing
- Supports parametrized execution via npm scripts

**Interface:**
```typescript
interface ProvisioningOptions {
  tenantName: string;
  workspaceName: string;
  apiKeyName?: string;
  scopes?: string[];
}

interface ProvisioningResult {
  tenant: { id: bigint; name: string };
  workspace: { id: bigint; name: string };
  apiKey: { id: bigint; value: string; hash: string };
}
```

### 2. Enhanced Event Validation

**Payload Size Limits:**
- Individual events: 256KB (reduced from current 1MB)
- Batch operations: 50 events maximum (reduced from current 1000)

**Schema Version Handling:**
```typescript
interface EventValidation {
  validatePayloadSize(payload: any, maxSize: number): ValidationResult;
  validateBatchSize(events: any[], maxCount: number): ValidationResult;
  extractSchemaVersion(headers: Record<string, string>): string;
  validateEventProperties(event: TrackEventDto): ValidationResult;
}
```

### 3. Deduplication Service

**Event ID Based Deduplication:**
```typescript
interface DeduplicationService {
  checkDuplicate(tenantId: bigint, eventId: string): Promise<boolean>;
  markProcessed(tenantId: bigint, eventId: string): Promise<void>;
}
```

**Database Schema Addition:**
```sql
CREATE TABLE event_deduplication (
  tenant_id BIGINT NOT NULL,
  event_id VARCHAR(32) NOT NULL, -- ID curto (ex.: base36 64-bit)
  processed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (tenant_id, event_id)
);
CREATE INDEX idx_event_dedup_processed ON event_deduplication(processed_at);
```

### 4. Enhanced Event Processing

**Updated Event Processor:**
```typescript
interface EventProcessorService {
  processTrackEvent(
    event: TrackEventDto, 
    tenant: TenantContext, 
    enrichment: EnrichmentData,
    eventId?: string
  ): Promise<ProcessingResult>;
  
  processBatchEvents(
    events: TrackEventDto[], 
    tenant: TenantContext, 
    enrichmentData: EnrichmentData[],
    eventIds?: string[]
  ): Promise<BatchProcessingResult>;
}
```

### 5. Infrastructure Components

**Docker Compose Configuration:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mercurio
      POSTGRES_USER: mercurio
      POSTGRES_PASSWORD: mercurio
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://mercurio:mercurio@postgres:5432/mercurio
```

**Makefile Targets:**
```makefile
.PHONY: up down seed logs

up:
	docker-compose up -d

down:
	docker-compose down

seed:
	npm run -w @mercurio/api db:seed

logs:
	docker-compose logs -f api
```

### 6. Structured Logging

**Log Context Interface:**
```typescript
interface LogContext {
  requestId: string;
  tenantId?: bigint;
  workspaceId?: bigint;
  anonymousId?: string;
  eventName?: string;
  timestamp: string;
}

interface StructuredLogger {
  logEventReceived(context: LogContext, payload: any): void;
  logEventProcessed(context: LogContext, eventId: string): void;
  logEventError(context: LogContext, error: Error): void;
  logDuplicateDetected(context: LogContext, eventId: string): void;
}
```

## Data Models

### Enhanced Event Model

The existing Prisma Event model will be extended to support the new requirements:

```typescript
// Addition to existing Event model
model Event {
  // ... existing fields
  eventId       String?  @map("event_id") @db.VarChar(32) // Optional client-provided short ID
  schemaVersion String   @map("schema_version") @db.VarChar(10) // From header or default
  
  // New index for deduplication
  @@index([tenantId, eventId]) // For deduplication queries
}
```

### Request Context Model

```typescript
interface RequestContext {
  requestId: string;
  tenantId: bigint;
  workspaceId: bigint;
  apiKeyId: bigint;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}
```

## Error Handling

### Validation Errors

```typescript
interface ValidationError {
  code: 'payload_too_large' | 'batch_too_large' | 'invalid_schema_version' | 'missing_required_field';
  message: string;
  details: Record<string, any>;
}
```

### Processing Errors

```typescript
interface ProcessingError {
  code: 'duplicate_event' | 'database_error' | 'enrichment_failed';
  message: string;
  eventId?: string;
  retryable: boolean;
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

## Testing Strategy

### Unit Tests

1. **Provisioning Script Tests**
   - Tenant/workspace creation with valid parameters
   - API key generation and hashing
   - Error handling for duplicate tenants
   - Parameter validation

2. **Validation Layer Tests**
   - Payload size validation (256KB limit)
   - Batch size validation (50 events limit)
   - Schema version extraction and defaults
   - Event property validation

3. **Deduplication Service Tests**
   - Duplicate detection by (tenant_id, event_id)
   - First-time event processing
   - Concurrent duplicate handling

### Integration Tests

1. **API Endpoint Tests**
   - Track event with valid payload
   - Batch events within limits
   - Identify operations
   - Error responses for invalid requests

2. **Database Integration Tests**
   - Event persistence with tenant isolation
   - Deduplication table operations
   - Schema version storage

### Performance Tests

1. **Latency Requirements**
   - p50 < 50ms for small payloads
   - p95 < 200ms for typical payloads
   - Batch processing efficiency

2. **Load Testing**
   - 95%+ success rate under normal load
   - Graceful degradation under high load

### End-to-End Tests

1. **Complete Flow Tests**
   - Tenant provisioning → API key creation → Event ingestion
   - SDK integration with real API endpoints
   - Health check functionality

## Performance Considerations

### Database Optimization

1. **Indexing Strategy**
   - Composite index on (tenant_id, event_id) for deduplication
   - Existing indexes on (tenant_id, workspace_id, timestamp) for queries
   - Cleanup job for old deduplication records

2. **Connection Pooling**
   - Prisma connection pool configuration
   - Database connection limits for Docker environment

### Memory Management

1. **Payload Processing**
   - Stream processing for large batches
   - Memory-efficient JSON parsing
   - Garbage collection optimization

### Caching Strategy

1. **API Key Validation**
   - In-memory cache for frequently used API keys
   - TTL-based cache invalidation

## Security Considerations

### API Key Management

1. **Key Generation**
   - Cryptographically secure random generation
   - SHA-256 hashing for storage
   - Prefix-based key identification (ak_)

2. **Key Validation**
   - Constant-time comparison for hash validation
   - Rate limiting per API key
   - Scope-based access control

### Data Protection

1. **Tenant Isolation**
   - Row-level security through tenant_id filtering
   - API key scoping to specific workspaces
   - Audit logging for cross-tenant access attempts

2. **Input Validation**
   - Strict payload size limits
   - JSON schema validation
   - SQL injection prevention through Prisma

## Monitoring and Observability

### Structured Logging

1. **Log Format**
   - JSON structured logs
   - Consistent field naming
   - Request correlation IDs

2. **Log Levels**
   - INFO: Successful event processing
   - WARN: Duplicate events, validation warnings
   - ERROR: Processing failures, system errors

### Health Checks

1. **Endpoint: `/health`**
   - Database connectivity check
   - API service status
   - Dependency health verification

2. **Metrics Collection**
   - Event processing rates
   - Error rates by type
   - Response time percentiles

### Request Tracing

1. **Correlation IDs (sem UUID)**
   - Gerar ID curto por requisição (64 bits em base36, ~13 caracteres) para reduzir custo e overhead
   - Propagação através de todas as entradas de log
   - Inclusão no header de resposta para o cliente
