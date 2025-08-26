# Sprint Requirements: Analytics Endpoints Basic

## Sprint Overview

**Sprint Name**: Analytics Endpoints Basic  
**Sprint Duration**: 2-3 weeks  
**Priority**: High  
**Epic**: Analytics & Reporting Infrastructure  

### Sprint Objectives

Implement foundational analytics endpoints in the Mercurio API to provide essential metrics and insights for traffic managers. These endpoints will serve as the foundation for the analytics dashboard and reporting features.

### Success Criteria

- All 6 core analytics endpoints are fully implemented and tested
- Performance targets are met (p50 < 100ms for all endpoints)
- Multi-tenant isolation is enforced across all endpoints
- Comprehensive test coverage (>90%) for all analytics functionality
- API documentation is complete with examples
- Export functionality supports multiple formats (JSON, CSV)

---

## Functional Requirements

### FR-001: Overview Metrics Endpoint
**Priority**: Must Have  
**Complexity**: Medium  

#### Description
Provide high-level aggregate metrics for a workspace within a specified time period.

#### Endpoint Specification
```
GET /v1/analytics/overview
Query Parameters:
- period: string (24h|7d|30d|custom) [required]
- start_date: ISO8601 datetime [required if period=custom]
- end_date: ISO8601 datetime [required if period=custom]
- timezone: string (default: UTC)
```

#### Response Structure
```json
{
  "period": {
    "type": "30d",
    "start": "2025-07-27T00:00:00Z",
    "end": "2025-08-26T23:59:59Z",
    "timezone": "UTC"
  },
  "metrics": {
    "total_events": 156742,
    "unique_visitors": 8934,
    "total_sessions": 12456,
    "conversion_rate": 2.34,
    "bounce_rate": 45.67,
    "avg_session_duration": 324.5,
    "top_event": "page_view"
  },
  "comparisons": {
    "total_events": { "value": 156742, "change_pct": 12.5, "previous": 139436 },
    "unique_visitors": { "value": 8934, "change_pct": -3.2, "previous": 9229 },
    "total_sessions": { "value": 12456, "change_pct": 8.1, "previous": 11525 }
  }
}
```

#### Acceptance Criteria
- [ ] Returns accurate aggregate metrics for the specified period
- [ ] Supports all predefined periods (24h, 7d, 30d) and custom date ranges
- [ ] Includes period-over-period comparison calculations
- [ ] Enforces multi-tenant isolation (workspace_id, tenant_id)
- [ ] Validates date range constraints (max 1 year for custom periods)
- [ ] Response time < 100ms for p50, < 500ms for p95
- [ ] Handles timezone conversion correctly

### FR-002: Time-Series Data Endpoint
**Priority**: Must Have  
**Complexity**: High  

#### Description
Provide time-series data for charts and trend analysis with configurable granularity.

#### Endpoint Specification
```
GET /v1/analytics/timeseries
Query Parameters:
- period: string (24h|7d|30d|custom) [required]
- start_date: ISO8601 datetime [required if period=custom]
- end_date: ISO8601 datetime [required if period=custom]
- granularity: string (hour|day|week) [required]
- metrics: array[string] (events|visitors|sessions|conversions) [required]
- timezone: string (default: UTC)
```

#### Response Structure
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00Z",
    "end": "2025-08-26T23:59:59Z",
    "granularity": "day",
    "timezone": "UTC"
  },
  "data": [
    {
      "timestamp": "2025-08-20T00:00:00Z",
      "events": 12345,
      "visitors": 890,
      "sessions": 1234,
      "conversions": 29
    },
    {
      "timestamp": "2025-08-21T00:00:00Z",
      "events": 13456,
      "visitors": 923,
      "sessions": 1345,
      "conversions": 31
    }
  ]
}
```

#### Acceptance Criteria
- [ ] Supports multiple metrics in a single request
- [ ] Granularity options work correctly for all time periods
- [ ] Data points are complete (no gaps in time series)
- [ ] Aggregation logic is accurate for each granularity level
- [ ] Response includes proper timestamp formatting
- [ ] Timezone handling works for all supported zones
- [ ] Performance remains acceptable for large date ranges

### FR-003: Top Events Ranking Endpoint
**Priority**: Must Have  
**Complexity**: Medium  

#### Description
Provide ranking of events by frequency with percentage calculations and trend indicators.

#### Endpoint Specification
```
GET /v1/analytics/events/top
Query Parameters:
- period: string (24h|7d|30d|custom) [required]
- start_date: ISO8601 datetime [required if period=custom]  
- end_date: ISO8601 datetime [required if period=custom]
- limit: integer (default: 10, max: 100)
- timezone: string (default: UTC)
```

#### Response Structure
```json
{
  "period": {
    "type": "7d",
    "start": "2025-08-20T00:00:00Z",
    "end": "2025-08-26T23:59:59Z",
    "timezone": "UTC"
  },
  "total_events": 156742,
  "events": [
    {
      "rank": 1,
      "event_name": "page_view",
      "count": 89234,
      "percentage": 56.94,
      "unique_visitors": 7234,
      "avg_per_visitor": 12.3,
      "trend": {
        "change_pct": 8.5,
        "direction": "up"
      }
    },
    {
      "rank": 2,
      "event_name": "button_click",
      "count": 34567,
      "percentage": 22.05,
      "unique_visitors": 5432,
      "avg_per_visitor": 6.4,
      "trend": {
        "change_pct": -2.1,
        "direction": "down"
      }
    }
  ]
}
```

#### Acceptance Criteria
- [ ] Events are correctly ranked by count in descending order
- [ ] Percentage calculations are accurate relative to total events
- [ ] Unique visitor counts are deduplicated correctly
- [ ] Trend calculations compare to previous period accurately
- [ ] Limit parameter restricts results appropriately
- [ ] Returns empty array when no events exist for period
- [ ] Handles edge cases (ties in ranking)

### FR-004: User Analytics Endpoint
**Priority**: Must Have  
**Complexity**: Medium  

#### Description
Provide insights into user behavior patterns, activity levels, and lead conversion metrics.

#### Endpoint Specification
```
GET /v1/analytics/users
Query Parameters:
- period: string (24h|7d|30d|custom) [required]
- start_date: ISO8601 datetime [required if period=custom]
- end_date: ISO8601 datetime [required if period=custom]
- segment: string (all|visitors|leads) [optional, default: all]
- timezone: string (default: UTC)
```

#### Response Structure
```json
{
  "period": {
    "type": "30d",
    "start": "2025-07-27T00:00:00Z", 
    "end": "2025-08-26T23:59:59Z",
    "timezone": "UTC"
  },
  "summary": {
    "total_visitors": 8934,
    "identified_leads": 267,
    "identification_rate": 2.99,
    "returning_visitors": 3456,
    "new_visitors": 5478
  },
  "activity_levels": [
    {
      "level": "high_activity",
      "description": "10+ events per session",
      "visitors": 1234,
      "percentage": 13.82,
      "avg_events_per_session": 15.4
    },
    {
      "level": "medium_activity", 
      "description": "3-9 events per session",
      "visitors": 4567,
      "percentage": 51.12,
      "avg_events_per_session": 6.2
    },
    {
      "level": "low_activity",
      "description": "1-2 events per session", 
      "visitors": 3133,
      "percentage": 35.06,
      "avg_events_per_session": 1.7
    }
  ],
  "conversion_funnel": {
    "visitors": 8934,
    "sessions_created": 7234,
    "events_generated": 5432, 
    "leads_identified": 267,
    "conversion_stages": [
      { "stage": "visitor", "count": 8934, "percentage": 100.0 },
      { "stage": "engaged", "count": 5432, "percentage": 60.8 },
      { "stage": "identified", "count": 267, "percentage": 2.99 }
    ]
  }
}
```

#### Acceptance Criteria
- [ ] User segmentation works correctly (visitors vs leads)
- [ ] Activity level calculations are accurate and meaningful
- [ ] Identification rate calculation is correct
- [ ] Returning vs new visitor logic is implemented properly
- [ ] Conversion funnel stages reflect actual user journey
- [ ] Segment filtering affects all relevant metrics
- [ ] Percentage calculations sum appropriately

### FR-005: Event Details with Advanced Filtering
**Priority**: Must Have  
**Complexity**: High  

#### Description
Provide detailed event data with advanced filtering capabilities for deep analysis.

#### Endpoint Specification
```
GET /v1/analytics/events/details
Query Parameters:
- period: string (24h|7d|30d|custom) [required]
- start_date: ISO8601 datetime [required if period=custom]
- end_date: ISO8601 datetime [required if period=custom]
- event_name: string [optional]
- anonymous_id: string [optional]  
- lead_id: string [optional]
- session_id: string [optional]
- has_lead: boolean [optional]
- page: integer (default: 1, min: 1)
- limit: integer (default: 50, max: 1000)
- sort_by: string (timestamp|event_name) [default: timestamp]
- sort_order: string (asc|desc) [default: desc]
- timezone: string (default: UTC)
```

#### Response Structure
```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total_events": 1567,
    "total_pages": 32,
    "has_next": true,
    "has_prev": false
  },
  "filters": {
    "period": "7d",
    "event_name": "page_view",
    "has_lead": true
  },
  "events": [
    {
      "event_id": "evt_123456789",
      "event_name": "page_view", 
      "timestamp": "2025-08-26T14:30:22Z",
      "anonymous_id": "a_abc123def456",
      "lead_id": "ld_789xyz321",
      "session_id": "s_session123",
      "page": {
        "url": "https://example.com/landing-page",
        "title": "Landing Page",
        "referrer": "https://google.com"
      },
      "utm": {
        "source": "google",
        "medium": "cpc",
        "campaign": "summer_sale"
      },
      "device": {
        "type": "desktop",
        "browser": "Chrome",
        "os": "Windows"
      },
      "geo": {
        "country": "US",
        "region": "CA",
        "city": "San Francisco"
      },
      "props": {
        "custom_prop": "value",
        "product_id": 12345
      }
    }
  ]
}
```

#### Acceptance Criteria
- [ ] All filter combinations work correctly
- [ ] Pagination handles large result sets efficiently  
- [ ] Sorting options work for all supported fields
- [ ] Event data includes all available context (page, utm, device, geo, props)
- [ ] Filter validation prevents invalid combinations
- [ ] Performance remains acceptable for large queries
- [ ] Proper handling of missing or null values

### FR-006: Export Functionality
**Priority**: Should Have  
**Complexity**: Medium  

#### Description
Enable data export in multiple formats for external analysis and reporting.

#### Endpoint Specification
```
POST /v1/analytics/export
Body:
{
  "dataset": "events|overview|timeseries|users",
  "format": "json|csv",
  "period": "24h|7d|30d|custom",
  "start_date": "ISO8601 datetime",
  "end_date": "ISO8601 datetime", 
  "filters": {}, // same as individual endpoint filters
  "timezone": "string"
}
```

#### Response Structure
```json
{
  "export_id": "exp_abc123def456",
  "status": "processing|completed|failed",
  "created_at": "2025-08-26T14:30:22Z",
  "download_url": "https://api.mercurio.com/v1/analytics/export/exp_abc123def456/download",
  "expires_at": "2025-08-27T14:30:22Z",
  "format": "csv",
  "estimated_size": "2.5MB",
  "record_count": 15678
}
```

#### Acceptance Criteria
- [ ] Supports all major analytics datasets
- [ ] CSV format includes proper headers and escaping
- [ ] JSON format maintains data type integrity
- [ ] Large exports are processed asynchronously
- [ ] Download URLs are secure and time-limited
- [ ] Export history is tracked per workspace
- [ ] Proper error handling for failed exports

---

## Technical Requirements

### TR-001: Performance Standards
**Priority**: Must Have  

#### Performance Targets
- **Response Time**: 
  - p50 < 100ms for all analytics endpoints
  - p95 < 500ms for all analytics endpoints
  - p99 < 1000ms for all analytics endpoints
- **Throughput**: Support 100+ concurrent requests per workspace
- **Resource Usage**: Memory usage < 512MB per analytics worker process

#### Database Optimization
- Utilize existing indexes on (tenant_id, workspace_id, timestamp)
- Implement query result caching for frequently accessed metrics
- Use read replicas for analytics queries when available
- Optimize aggregation queries with proper GROUP BY strategies

### TR-002: Multi-Tenant Security
**Priority**: Must Have  

#### Data Isolation
- All queries must include tenant_id and workspace_id filters
- Implement row-level security validation in service layer
- Ensure no data leakage between workspaces
- Validate API key scopes for analytics access

#### Access Control
- Require 'read' or 'analytics:read' scope for all analytics endpoints
- Implement workspace-specific rate limiting
- Log all analytics access for audit purposes

### TR-003: Data Quality & Reliability
**Priority**: Must Have  

#### Data Consistency
- Handle timezone conversions accurately across all endpoints
- Ensure aggregate calculations match detail-level sums
- Implement data validation for edge cases (null values, missing timestamps)
- Handle database connection failures gracefully

#### Error Handling
- Return consistent error response format across all endpoints
- Implement proper HTTP status codes for different error types
- Provide meaningful error messages for invalid requests
- Log errors with sufficient context for debugging

### TR-004: Scalability Architecture
**Priority**: Should Have  

#### Caching Strategy
- Implement Redis-based caching for frequently requested metrics
- Cache TTL should be configurable per metric type
- Implement cache warming for common queries
- Support cache invalidation on data updates

#### Query Optimization
- Use materialized views for complex aggregations where possible
- Implement query result pagination for large datasets
- Optimize JSON field queries with proper indexing strategies
- Monitor slow query log and optimize problematic queries

---

## API Standards & Conventions

### AS-001: Request/Response Format
- Follow existing Mercurio API conventions for error responses
- Use consistent date/time formatting (ISO8601 with UTC)
- Implement proper HTTP status codes (200, 400, 401, 403, 404, 500)
- Support JSON content-type for all requests/responses

### AS-002: Authentication & Authorization  
- Use existing ApiKeyGuard for authentication
- Implement RequireScopes decorator for endpoint authorization
- Support tenant context injection via CurrentTenant decorator
- Follow existing rate limiting patterns

### AS-003: Validation & Error Handling
- Use class-validator for DTO validation
- Implement custom validation for date ranges and periods
- Return structured error responses with error codes
- Log validation failures for monitoring

---

## Dependencies & Assumptions

### Dependencies
- **Internal**: Existing Prisma schema and database structure
- **Internal**: API key authentication system and tenant context
- **Internal**: Rate limiting infrastructure
- **Internal**: Logging service (MercurioLogger)
- **External**: PostgreSQL 15+ with existing indexes
- **External**: Redis for caching (optional but recommended)

### Assumptions
- Event data is consistently stored in the existing event table structure
- Timezone data is available and valid in request contexts
- Database performance is adequate for analytical queries
- API key scopes will be extended to include analytics permissions

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|---------|-------------|-------------------|
| Query performance degradation | High | Medium | Implement query optimization, caching, and monitoring |
| Large result sets causing timeouts | Medium | High | Implement pagination, result limiting, and async processing |
| Memory consumption on complex aggregations | Medium | Medium | Optimize queries, implement result streaming |
| Cache inconsistency | Low | Low | Implement proper cache invalidation strategies |

---

## Definition of Done

### Code Quality
- [ ] All endpoints implemented with TypeScript strict mode
- [ ] Comprehensive unit tests with >90% coverage
- [ ] Integration tests covering multi-tenant scenarios
- [ ] Code reviewed and approved by senior developer
- [ ] No ESLint warnings or errors

### Performance & Security
- [ ] Performance targets met in staging environment
- [ ] Security review completed for multi-tenant isolation
- [ ] Rate limiting tested and configured appropriately
- [ ] Error handling tested for edge cases

### Documentation & Deployment
- [ ] API documentation updated with endpoint specifications
- [ ] Postman collection created with example requests
- [ ] Database migration scripts created if needed
- [ ] Deployment checklist completed

### Testing & Validation
- [ ] Manual testing completed for all user scenarios
- [ ] Load testing performed for performance validation
- [ ] Cross-browser testing for timezone handling
- [ ] Data accuracy validated against known datasets

---

## Sprint Backlog & Tasks

### Phase 1: Foundation (Week 1)
- [ ] **ANLT-001**: Create analytics module structure and base service classes
- [ ] **ANLT-002**: Implement overview metrics endpoint with basic aggregations
- [ ] **ANLT-003**: Set up analytics controller with authentication and validation
- [ ] **ANLT-004**: Implement timezone handling utilities
- [ ] **ANLT-005**: Create comprehensive DTO classes for all endpoints

### Phase 2: Core Analytics (Week 2)
- [ ] **ANLT-006**: Implement time-series data endpoint with granularity options
- [ ] **ANLT-007**: Implement top events ranking with trend calculations
- [ ] **ANLT-008**: Implement user analytics with activity level segmentation
- [ ] **ANLT-009**: Add caching layer for frequently accessed metrics
- [ ] **ANLT-010**: Optimize database queries and add performance monitoring

### Phase 3: Advanced Features (Week 3)
- [ ] **ANLT-011**: Implement event details endpoint with advanced filtering
- [ ] **ANLT-012**: Implement export functionality with async processing
- [ ] **ANLT-013**: Add comprehensive error handling and validation
- [ ] **ANLT-014**: Create integration tests for multi-tenant scenarios
- [ ] **ANLT-015**: Performance testing and optimization refinements

### Phase 4: Documentation & Polish
- [ ] **ANLT-016**: Complete API documentation with examples
- [ ] **ANLT-017**: Create Postman collection for testing
- [ ] **ANLT-018**: Final performance validation and load testing  
- [ ] **ANLT-019**: Security review and penetration testing
- [ ] **ANLT-020**: Deployment preparation and production readiness check

---

## Success Metrics

### Technical Metrics
- **Response Time**: p50 < 100ms achieved for all endpoints
- **Test Coverage**: >90% code coverage maintained
- **Error Rate**: <1% error rate in production
- **Performance**: No degradation in existing API performance

### Business Metrics
- **API Adoption**: Analytics endpoints used by >80% of active workspaces within 30 days
- **Query Volume**: Support for 10,000+ analytics queries per day
- **User Satisfaction**: Positive feedback from beta testers on data accuracy and performance

This sprint will establish the foundational analytics capabilities for the Mercurio platform, enabling traffic managers to gain essential insights into their funnel performance and user behavior patterns.