# Observability — Sprint 1 Ingestão Operacional

## 🎯 Overview

Este documento especifica a implementação de **observabilidade básica** para o sistema de ingestão, incluindo **logs estruturados**, **correlação de requests** e **métricas fundamentais**.

---

## 📊 Logging Strategy

### Core Requirements
- ✅ **Structured JSON logs** para parsing automático
- ✅ **Tenant/workspace context** em todos os logs relacionados a eventos
- ✅ **Request correlation** via `X-Request-ID` 
- ✅ **Security-first** - sem PII em logs de produção

### 1. Logger Service Implementation  

**File**: `/Users/tocha/Dev/gtm-master/apps/api/src/common/services/logger.service.ts`

```typescript
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  workspaceId?: string;
  userId?: string;
  apiKeyId?: string;
  eventId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: LogContext;
  meta?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

@Injectable()
export class MercurioLogger implements NestLoggerService {
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly logLevel = process.env.LOG_LEVEL || 'info';

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private formatLog(level: StructuredLogEntry['level'], message: string, context?: LogContext, meta?: Record<string, any>, error?: Error): string {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(meta && { meta }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          code: (error as any).code
        }
      })
    };

    if (this.isDevelopment) {
      // Pretty print for development
      const contextStr = context ? ` [${context.tenantId || 'no-tenant'}:${context.requestId || 'no-req'}]` : '';
      return `${entry.timestamp} ${level.toUpperCase()}${contextStr} ${message}${error ? ` - ${error.message}` : ''}`;
    }

    // JSON for production
    return JSON.stringify(entry);
  }

  log(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context, meta));
    }
  }

  error(message: string, error?: Error, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context, meta, error));
    }
  }

  warn(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context, meta));
    }
  }

  debug(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context, meta));
    }
  }

  // Specific business event logging
  logEventIngestion(eventName: string, context: LogContext, meta: { 
    eventId?: string;
    payloadSize: number;
    processingTimeMs: number;
    isDuplicate?: boolean;
  }) {
    this.log(`Event ingested: ${eventName}`, context, {
      category: 'event_ingestion',
      ...meta
    });
  }

  logApiKeyUsage(apiKeyId: string, context: LogContext, meta: {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
  }) {
    this.log('API key used', { ...context, apiKeyId }, {
      category: 'api_key_usage',
      ...meta
    });
  }

  logTenantProvisioning(tenantId: string, workspaceId: string, context: LogContext) {
    this.log('Tenant provisioned', { ...context, tenantId, workspaceId }, {
      category: 'tenant_provisioning'
    });
  }

  logRateLimitHit(tenantId: string, context: LogContext, meta: {
    limit: number;
    current: number;
    windowMs: number;
  }) {
    this.warn('Rate limit hit', { ...context, tenantId }, {
      category: 'rate_limiting',
      ...meta
    });
  }
}
```

### 2. Request Context Middleware

**File**: `/Users/tocha/Dev/gtm-master/apps/api/src/common/middleware/request-context.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

export const REQUEST_CONTEXT_KEY = 'requestContext';

export interface RequestContext {
  requestId: string;
  startTime: number;
  tenantId?: string;
  workspaceId?: string;
  apiKeyId?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate or extract request ID
    const requestId = (req.headers['x-request-id'] as string) || this.generateRequestId();
    
    // Create request context
    const requestContext: RequestContext = {
      requestId,
      startTime: Date.now()
    };

    // Store in request object
    req[REQUEST_CONTEXT_KEY] = requestContext;

    // Set response header
    res.setHeader('X-Request-ID', requestId);

    // Log request start
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Request started',
      context: {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      },
      meta: { category: 'http_request' }
    }));

    // Log request completion
    res.on('finish', () => {
      const duration = Date.now() - requestContext.startTime;
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Request completed',
        context: {
          requestId,
          tenantId: requestContext.tenantId,
          workspaceId: requestContext.workspaceId
        },
        meta: {
          category: 'http_request',
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          contentLength: res.getHeader('content-length')
        }
      }));
    });

    next();
  }

  private generateRequestId(): string {
    // Generate short, readable request ID (not UUID for better logs)
    return randomBytes(4).toString('hex');
  }
}
```

### 3. Enhanced ApiKeyGuard with Logging

**File**: Update to `/Users/tocha/Dev/gtm-master/apps/api/src/common/auth/api-key.guard.ts`

**Add logging to existing guard**:
```typescript
// Add to existing imports
import { MercurioLogger } from '../services/logger.service';
import { REQUEST_CONTEXT_KEY } from '../middleware/request-context.middleware';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
    private readonly logger: MercurioLogger, // ← Add logger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestContext = request[REQUEST_CONTEXT_KEY];
    
    // ... existing API key extraction logic ...

    // Log API key usage attempt
    const logContext = {
      requestId: requestContext?.requestId,
      endpoint: request.url,
      method: request.method,
      ip: this.getClientIp(request)
    };

    if (!apiKey) {
      this.logger.warn('Missing API key in request', logContext);
      throw new UnauthorizedException(/* ... existing error */);
    }

    // ... existing validation logic ...

    if (!validationResult.isValid) {
      this.logger.warn('Invalid API key used', {
        ...logContext,
        apiKeyId: validationResult.apiKeyId,
        reason: 'invalid_or_revoked'
      });
      throw new UnauthorizedException(/* ... existing error */);
    }

    // Update request context with tenant info
    if (requestContext) {
      requestContext.tenantId = validationResult.tenantId;
      requestContext.workspaceId = validationResult.workspaceId;
      requestContext.apiKeyId = validationResult.apiKeyId;
    }

    // Log successful API key usage
    this.logger.logApiKeyUsage(validationResult.apiKeyId!, {
      ...logContext,
      tenantId: validationResult.tenantId,
      workspaceId: validationResult.workspaceId
    }, {
      endpoint: request.url,
      method: request.method,
      statusCode: 200, // Will be updated in middleware
      responseTimeMs: Date.now() - (requestContext?.startTime || Date.now())
    });

    return true;
  }
}
```

### 4. Enhanced Event Processing with Logging

**File**: Update to `/Users/tocha/Dev/gtm-master/apps/api/src/events/services/event-processor.service.ts`

```typescript
// Add to existing imports
import { MercurioLogger, LogContext } from '../../common/services/logger.service';

@Injectable() 
export class EventProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger, // ← Add logger
  ) {}

  async processTrackEvent(event: TrackEventDto, tenant: TenantContext, enrichmentData: any, requestContext?: any) {
    const startTime = Date.now();
    const logContext: LogContext = {
      requestId: requestContext?.requestId,
      tenantId: tenant.tenantId,
      workspaceId: tenant.workspaceId,
      eventId: event.event_id
    };

    this.logger.debug('Processing track event', logContext, {
      eventName: event.event_name,
      hasEventId: !!event.event_id,
      schemaVersion: enrichmentData.schemaVersion
    });

    try {
      // ... existing processing logic ...

      const processingTime = Date.now() - startTime;

      // Log successful event ingestion
      this.logger.logEventIngestion(event.event_name, logContext, {
        eventId: result.eventId,
        payloadSize: JSON.stringify(event).length,
        processingTimeMs: processingTime,
        isDuplicate: result.isDuplicate
      });

      return result;

    } catch (error) {
      this.logger.error('Event processing failed', error, logContext, {
        eventName: event.event_name,
        processingTimeMs: Date.now() - startTime
      });
      throw error;
    }
  }
}
```

---

## 🔍 Metrics Collection

### 1. Basic Metrics Service

**File**: `/Users/tocha/Dev/gtm-master/apps/api/src/common/services/metrics.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface HistogramBucket {
  count: number;
  sum: number;
  buckets: Map<number, number>; // le -> count
}

@Injectable()
export class MetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramBucket>();

  // Counter methods
  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1) {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // Gauge methods
  setGauge(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  getGauge(name: string, labels: Record<string, string> = {}): number | undefined {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key);
  }

  // Histogram methods
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.buildKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, {
        count: 0,
        sum: 0,
        buckets: new Map()
      });
    }

    const histogram = this.histograms.get(key)!;
    histogram.count++;
    histogram.sum += value;

    // Update buckets (simple implementation)
    const buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const bucket of buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  // Business metrics methods
  recordEventIngestion(tenantId: string, eventName: string, processingTimeMs: number, success = true) {
    const labels = { tenant_id: tenantId, event_name: eventName };
    
    this.incrementCounter('events_ingested_total', { ...labels, status: success ? 'success' : 'error' });
    this.recordHistogram('event_processing_duration_ms', processingTimeMs, labels);
  }

  recordApiKeyUsage(tenantId: string, endpoint: string, statusCode: number, responseTimeMs: number) {
    const labels = { 
      tenant_id: tenantId, 
      endpoint, 
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`
    };
    
    this.incrementCounter('api_requests_total', labels);
    this.recordHistogram('api_request_duration_ms', responseTimeMs, labels);
  }

  recordRateLimitHit(tenantId: string) {
    this.incrementCounter('rate_limits_hit_total', { tenant_id: tenantId });
  }

  // Export metrics for health endpoint
  exportMetrics() {
    const metrics = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {}
    };

    // Convert histograms to exportable format
    for (const [key, histogram] of this.histograms) {
      metrics.histograms[key] = {
        count: histogram.count,
        sum: histogram.sum,
        avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        buckets: Object.fromEntries(histogram.buckets)
      };
    }

    return metrics;
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  // Calculate percentiles from histogram (simple approximation)
  getPercentile(name: string, percentile: number, labels: Record<string, string> = {}): number {
    const key = this.buildKey(name, labels);
    const histogram = this.histograms.get(key);
    
    if (!histogram || histogram.count === 0) {
      return 0;
    }

    const targetCount = Math.ceil((percentile / 100) * histogram.count);
    let cumulativeCount = 0;
    
    for (const [bucket, count] of Array.from(histogram.buckets.entries()).sort((a, b) => a[0] - b[0])) {
      cumulativeCount += count;
      if (cumulativeCount >= targetCount) {
        return bucket;
      }
    }
    
    return Array.from(histogram.buckets.keys()).sort((a, b) => b - a)[0] || 0;
  }
}
```

### 2. Enhanced Health Check with Metrics

**File**: Update to `/Users/tocha/Dev/gtm-master/apps/api/src/health.controller.ts`

```typescript
// Add to existing imports
import { MetricsService } from './common/services/metrics.service';

interface HealthStatus {
  // ... existing fields
  metrics?: {
    requests_total: number;
    events_ingested_total: number;
    avg_response_time_ms: number;
    p50_response_time_ms: number;
    p99_response_time_ms: number;
    error_rate_percent: number;
  };
}

@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private metricsService: MetricsService, // ← Add metrics service
  ) {}

  @Get('health')
  async getHealth(): Promise<HealthStatus> {
    // ... existing health check logic

    // Add metrics to health response
    const metrics = this.buildMetricsSummary();

    const health: HealthStatus = {
      // ... existing fields
      ...(metrics && { metrics })
    };

    return health;
  }

  @Get('metrics')
  getMetrics() {
    // Raw metrics export (for monitoring tools)
    return this.metricsService.exportMetrics();
  }

  private buildMetricsSummary() {
    try {
      const totalRequests = this.metricsService.getCounter('api_requests_total');
      const totalEvents = this.metricsService.getCounter('events_ingested_total');
      const errorRequests = this.metricsService.getCounter('api_requests_total', { status_class: '4xx' }) +
                           this.metricsService.getCounter('api_requests_total', { status_class: '5xx' });

      if (totalRequests === 0) {
        return null; // No metrics available yet
      }

      return {
        requests_total: totalRequests,
        events_ingested_total: totalEvents,
        avg_response_time_ms: this.metricsService.getPercentile('api_request_duration_ms', 50),
        p50_response_time_ms: this.metricsService.getPercentile('api_request_duration_ms', 50),
        p99_response_time_ms: this.metricsService.getPercentile('api_request_duration_ms', 99),
        error_rate_percent: totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100 * 100) / 100 : 0
      };
    } catch (error) {
      return null;
    }
  }
}
```

---

## 🔧 Configuration & Setup

### 1. Module Integration

**File**: `/Users/tocha/Dev/gtm-master/apps/api/src/app.module.ts`

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
// ... existing imports
import { MercurioLogger } from './common/services/logger.service';
import { MetricsService } from './common/services/metrics.service';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

@Module({
  imports: [
    // ... existing modules
  ],
  providers: [
    // ... existing providers
    MercurioLogger,
    MetricsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
```

### 2. Environment Variables

**Update to `/Users/tocha/Dev/gtm-master/apps/api/.env.example`**

```bash
# ... existing variables

# -----------------------------------------------------------------------------  
# LOGGING & OBSERVABILITY
# -----------------------------------------------------------------------------
# Log level: error, warn, info, debug
LOG_LEVEL=info

# Log format: json, pretty  
LOG_FORMAT=json

# Enable request correlation
ENABLE_REQUEST_CORRELATION=true

# Metrics collection
ENABLE_METRICS=true
METRICS_ENDPOINT_ENABLED=true

# Request ID header name
REQUEST_ID_HEADER=X-Request-ID
```

---

## 📊 Log Examples

### 1. Structured Event Ingestion Log
```json
{
  "timestamp": "2024-08-24T15:30:45.123Z",
  "level": "info", 
  "message": "Event ingested: button_click",
  "context": {
    "requestId": "a7b2c3d4",
    "tenantId": "123",
    "workspaceId": "456", 
    "eventId": "evt_789abc"
  },
  "meta": {
    "category": "event_ingestion",
    "eventId": "evt_789abc",
    "payloadSize": 512,
    "processingTimeMs": 23,
    "isDuplicate": false
  }
}
```

### 2. API Key Usage Log
```json
{
  "timestamp": "2024-08-24T15:30:45.100Z",
  "level": "info",
  "message": "API key used",
  "context": {
    "requestId": "a7b2c3d4",
    "tenantId": "123",
    "workspaceId": "456",
    "apiKeyId": "key_xyz"
  },
  "meta": {
    "category": "api_key_usage", 
    "endpoint": "/v1/events/track",
    "method": "POST",
    "statusCode": 200,
    "responseTimeMs": 45
  }
}
```

### 3. Error Log
```json
{
  "timestamp": "2024-08-24T15:31:02.456Z",
  "level": "error",
  "message": "Event processing failed",
  "context": {
    "requestId": "b8c3d4e5",
    "tenantId": "123",
    "eventId": "evt_failed"
  },
  "meta": {
    "eventName": "purchase",
    "processingTimeMs": 1200
  },
  "error": {
    "name": "ValidationError",
    "message": "Invalid event properties", 
    "code": "INVALID_PAYLOAD"
  }
}
```

---

## ✅ Monitoring Dashboard

### Key Metrics to Track

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Request Rate** | Requests per second | >100 req/s | <10 req/s |
| **Response Time p50** | Median response time | <50ms | >200ms |  
| **Response Time p99** | 99th percentile | <200ms | >1000ms |
| **Error Rate** | 4xx/5xx percentage | <1% | >5% |
| **Event Ingestion Rate** | Events per second | Variable | Drop >50% |
| **Database Health** | Connection status | OK | Error |
| **Memory Usage** | Heap utilization | <200MB | >400MB |

### Log Queries (Example for Elasticsearch/Kibana)

```json
# High-level request overview
{
  "query": {
    "bool": {
      "must": [
        {"term": {"level": "info"}},
        {"term": {"meta.category": "http_request"}}
      ]
    }
  },
  "aggs": {
    "status_codes": {"terms": {"field": "meta.statusCode"}},
    "response_times": {"histogram": {"field": "meta.duration"}}
  }
}

# Events by tenant
{
  "query": {
    "bool": {
      "must": [
        {"term": {"meta.category": "event_ingestion"}},
        {"range": {"timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "aggs": {
    "by_tenant": {"terms": {"field": "context.tenantId"}}
  }
}
```

---

## ✅ Acceptance Criteria

- [ ] Structured JSON logs implemented
- [ ] Request correlation working (X-Request-ID) 
- [ ] Tenant context in all event-related logs
- [ ] PII excluded from production logs
- [ ] Metrics collection operational
- [ ] Health endpoint includes metrics
- [ ] Error logs include stack traces (dev only)
- [ ] Log levels configurable via environment
- [ ] Performance impact minimal (<5ms overhead)
- [ ] Dashboard queries documented