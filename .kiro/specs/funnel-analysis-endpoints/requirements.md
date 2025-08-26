# Funnel Analysis Endpoints - Technical Requirements

## Sprint Overview

**Sprint Name**: Funnel Analysis Endpoints Implementation  
**Sprint Duration**: 3-4 weeks  
**Sprint Objective**: Implement comprehensive funnel analysis capabilities as an extension to the existing AnalyticsModule

### Business Context

Mercurio's funnel analytics platform requires advanced funnel configuration management, sophisticated analytics calculations, real-time tracking capabilities, and multi-dimensional attribution analysis. This sprint extends the existing analytics infrastructure to provide these comprehensive funnel analysis features.

## Functional Requirements

### FR-1: Funnel Configuration Management

**FR-1.1: CRUD Operations for Funnels**
- **REQ-1.1.1**: Create new funnel configurations with name, description, and metadata
- **REQ-1.1.2**: List all funnels for a workspace with filtering and pagination
- **REQ-1.1.3**: Retrieve detailed funnel configuration by ID
- **REQ-1.1.4**: Update funnel metadata (name, description, archive status)
- **REQ-1.1.5**: Archive/restore funnels (soft delete pattern)
- **REQ-1.1.6**: Validate funnel configuration integrity on create/update

**FR-1.2: Funnel Step Configuration**
- **REQ-1.2.1**: Define funnel steps with order, type (start|page|event|decision|conversion), and labels
- **REQ-1.2.2**: Configure step matching rules (page URLs, event names, property filters)
- **REQ-1.2.3**: Support multiple matching conditions per step (OR logic)
- **REQ-1.2.4**: Validate step order and dependencies
- **REQ-1.2.5**: Support custom event property matching with operators (equals, contains, regex)

**FR-1.3: Funnel Versioning & A/B Testing**
- **REQ-1.3.1**: Create funnel versions with draft/published states
- **REQ-1.3.2**: Publish funnel versions with time window configuration
- **REQ-1.3.3**: Support concurrent published versions for A/B testing
- **REQ-1.3.4**: Version comparison and migration utilities
- **REQ-1.3.5**: Rollback functionality for published funnels

**FR-1.4: Time Window Configuration**
- **REQ-1.4.1**: Configure conversion time windows (1-90 days)
- **REQ-1.4.2**: Set step-specific timeout configurations
- **REQ-1.4.3**: Support sliding window calculations
- **REQ-1.4.4**: Handle timezone-aware time window calculations

### FR-2: Funnel Analytics & Metrics

**FR-2.1: Conversion Rate Analysis**
- **REQ-2.1.1**: Calculate overall funnel conversion rates
- **REQ-2.1.2**: Calculate step-to-step conversion rates
- **REQ-2.1.3**: Calculate conversion rates by segments (device, traffic source, user type)
- **REQ-2.1.4**: Support time-based conversion rate trends
- **REQ-2.1.5**: Calculate statistical significance for A/B tests

**FR-2.2: Drop-off Analysis**
- **REQ-2.2.1**: Identify drop-off points with highest user loss
- **REQ-2.2.2**: Calculate drop-off percentages by step
- **REQ-2.2.3**: Segment drop-off analysis by user attributes
- **REQ-2.2.4**: Trend analysis for drop-off patterns over time
- **REQ-2.2.5**: Export detailed drop-off data for external analysis

**FR-2.3: Cohort Analysis**
- **REQ-2.3.1**: Group users by funnel entry date/period
- **REQ-2.3.2**: Track cohort progression through funnel steps
- **REQ-2.3.3**: Calculate cohort retention and conversion rates
- **REQ-2.3.4**: Support custom cohort grouping criteria
- **REQ-2.3.5**: Visualize cohort performance over time

**FR-2.4: Segment Analysis**
- **REQ-2.4.1**: Analyze funnel performance by device type (mobile, desktop, tablet)
- **REQ-2.4.2**: Analyze by traffic source (organic, paid, social, direct, referral)
- **REQ-2.4.3**: Analyze by user type (new, returning, identified, anonymous)
- **REQ-2.4.4**: Support custom segment definitions with property filters
- **REQ-2.4.5**: Compare segment performance with statistical tests

**FR-2.5: Time-to-Conversion Metrics**
- **REQ-2.5.1**: Calculate median time between funnel steps
- **REQ-2.5.2**: Calculate percentile distributions (p25, p75, p90, p95)
- **REQ-2.5.3**: Identify slow conversion paths and bottlenecks
- **REQ-2.5.4**: Support time-to-conversion by segments
- **REQ-2.5.5**: Track conversion velocity trends over time

### FR-3: Real-time Funnel Tracking

**FR-3.1: User Progression Tracking**
- **REQ-3.1.1**: Track individual user journeys through funnels in real-time
- **REQ-3.1.2**: Maintain user state across sessions and devices
- **REQ-3.1.3**: Support partial funnel completion tracking
- **REQ-3.1.4**: Handle out-of-order step completion
- **REQ-3.1.5**: Resolve user identity linking for accurate progression

**FR-3.2: Performance Monitoring**
- **REQ-3.2.1**: Monitor live conversion rates with configurable alerts
- **REQ-3.2.2**: Track funnel performance degradation
- **REQ-3.2.3**: Generate alerts for significant conversion drops
- **REQ-3.2.4**: Support webhook notifications for critical events
- **REQ-3.2.5**: Dashboard for real-time funnel health monitoring

**FR-3.3: Bottleneck Detection**
- **REQ-3.3.1**: Automatically identify steps with abnormal drop-off rates
- **REQ-3.3.2**: Compare current performance to historical baselines
- **REQ-3.3.3**: Generate actionable insights for optimization
- **REQ-3.3.4**: Support manual threshold configuration
- **REQ-3.3.5**: Correlate bottlenecks with external factors (time, traffic)

### FR-4: Advanced Funnel Features

**FR-4.1: Multi-path Funnel Support**
- **REQ-4.1.1**: Define alternative paths to conversion
- **REQ-4.1.2**: Support branching and merging funnel flows
- **REQ-4.1.3**: Track path popularity and effectiveness
- **REQ-4.1.4**: Calculate conversion rates for each path variant
- **REQ-4.1.5**: Support conditional step logic based on user properties

**FR-4.2: Advanced Event Property Matching**
- **REQ-4.2.1**: Support complex property matching with AND/OR logic
- **REQ-4.2.2**: Enable regex-based property value matching
- **REQ-4.2.3**: Support numeric range matching for properties
- **REQ-4.2.4**: Enable array/object property matching
- **REQ-4.2.5**: Support dynamic property comparison between steps

**FR-4.3: Attribution Analysis**
- **REQ-4.3.1**: Implement first-touch attribution tracking
- **REQ-4.3.2**: Implement last-touch attribution tracking
- **REQ-4.3.3**: Implement linear multi-touch attribution
- **REQ-4.3.4**: Implement time-decay attribution models
- **REQ-4.3.5**: Support custom attribution model configuration

**FR-4.4: Funnel Comparison & Optimization**
- **REQ-4.4.1**: Compare funnel performance across time periods
- **REQ-4.4.2**: A/B test different funnel configurations
- **REQ-4.4.3**: Statistical significance testing for comparisons
- **REQ-4.4.4**: Generate optimization recommendations
- **REQ-4.4.5**: Export comparison data for external analysis

**FR-4.5: Export & Integration**
- **REQ-4.5.1**: Export funnel data in CSV/JSON formats
- **REQ-4.5.2**: Support scheduled export generation
- **REQ-4.5.3**: Integrate with existing export infrastructure
- **REQ-4.5.4**: Support webhook integration for real-time data
- **REQ-4.5.5**: Enable API access for custom integrations

## Technical Specifications

### TS-1: Architecture Integration

**TS-1.1: Module Structure**
- Extend existing AnalyticsModule with FunnelAnalyticsModule
- Maintain separation of concerns with dedicated controllers, services, and repositories
- Reuse existing infrastructure (caching, logging, monitoring)
- Follow established patterns from AnalyticsController

**TS-1.2: Database Schema Extensions**
- Utilize existing funnel tables: funnel, funnel_version, funnel_publication, funnel_step, funnel_step_match
- Add necessary indexes for performance optimization
- Ensure multi-tenant isolation with tenant_id and workspace_id
- Support efficient querying for analytics calculations

**TS-1.3: Performance Requirements**
- **P50 < 200ms** for simple funnel analytics queries
- **P95 < 2s** for complex funnel reports and calculations
- **P99 < 5s** for large-scale cohort analysis
- Support concurrent analysis of multiple funnels
- Implement intelligent caching for frequently accessed data

### TS-2: API Design Specifications

**TS-2.1: RESTful Endpoints**
```
# Funnel Configuration
POST   /v1/analytics/funnels                    # Create funnel
GET    /v1/analytics/funnels                    # List funnels
GET    /v1/analytics/funnels/:id                # Get funnel details
PATCH  /v1/analytics/funnels/:id                # Update funnel
DELETE /v1/analytics/funnels/:id                # Archive funnel

# Funnel Versions
POST   /v1/analytics/funnels/:id/versions       # Create version
GET    /v1/analytics/funnels/:id/versions       # List versions
POST   /v1/analytics/funnels/:id/versions/:v/publish  # Publish version
POST   /v1/analytics/funnels/:id/versions/:v/rollback # Rollback version

# Funnel Analytics
GET    /v1/analytics/funnels/:id/conversion     # Conversion rates
GET    /v1/analytics/funnels/:id/dropoff        # Drop-off analysis
GET    /v1/analytics/funnels/:id/cohorts        # Cohort analysis
GET    /v1/analytics/funnels/:id/segments       # Segment analysis
GET    /v1/analytics/funnels/:id/timing         # Time-to-conversion

# Real-time Tracking  
GET    /v1/analytics/funnels/:id/live           # Live metrics
GET    /v1/analytics/funnels/:id/users/:userId  # User progression
GET    /v1/analytics/funnels/:id/bottlenecks    # Bottleneck detection

# Advanced Features
GET    /v1/analytics/funnels/:id/paths          # Multi-path analysis
GET    /v1/analytics/funnels/:id/attribution    # Attribution analysis
POST   /v1/analytics/funnels/compare            # Compare funnels
POST   /v1/analytics/funnels/:id/export         # Export data
```

**TS-2.2: Authentication & Authorization**
- Integrate with existing API key authentication system
- Extend API key scopes to include funnel-specific permissions:
  - `funnels:read` - View funnel configurations and analytics
  - `funnels:write` - Create and modify funnel configurations
  - `funnels:admin` - Full funnel management including deletion
- Maintain multi-tenant isolation at all endpoint levels

**TS-2.3: Rate Limiting**
- Standard endpoints: 1000 requests/hour per workspace
- Heavy analytics endpoints: 100 requests/hour per workspace
- Export endpoints: 10 requests/hour per workspace
- Real-time endpoints: 500 requests/hour per workspace
- Implement intelligent rate limiting based on query complexity

### TS-3: Data Processing & Storage

**TS-3.1: Funnel Calculation Engine**
- Implement efficient algorithms for conversion rate calculations
- Support incremental calculation updates for new events
- Utilize PostgreSQL window functions for performance
- Implement caching layer for frequently accessed calculations
- Support distributed calculation for large datasets

**TS-3.2: Real-time Processing**
- Process events in near real-time for funnel progression updates
- Maintain user state cache for active funnel sessions
- Implement efficient event matching against funnel step rules
- Support event deduplication for accurate progression tracking

**TS-3.3: Caching Strategy**
- Cache funnel configurations with 5-minute TTL
- Cache analytics results with 15-minute TTL (configurable)
- Implement smart cache invalidation on configuration changes
- Use Redis for distributed caching across instances
- Support cache warming for popular funnels

### TS-4: Monitoring & Observability

**TS-4.1: Structured Logging**
- Log all funnel operations with correlation IDs
- Include performance metrics (query duration, result size)
- Log funnel configuration changes for audit trail
- Implement debug logging for complex calculations
- Follow existing Pino logging patterns

**TS-4.2: Metrics & Monitoring**
- Track endpoint response times and success rates
- Monitor funnel calculation performance
- Track cache hit ratios and effectiveness
- Monitor real-time processing delays
- Implement health checks for funnel services

**TS-4.3: Error Handling**
- Implement comprehensive error handling for all endpoints
- Provide meaningful error messages for configuration issues
- Handle calculation errors gracefully with fallbacks
- Support retry logic for transient failures
- Maintain error correlation across services

## Acceptance Criteria

### AC-1: Funnel Configuration Management
- [ ] **AC-1.1**: Users can create funnels with valid configurations
- [ ] **AC-1.2**: Users can update funnel metadata without affecting active tracking
- [ ] **AC-1.3**: Funnel versioning works correctly with proper state management
- [ ] **AC-1.4**: Step matching rules validate correctly and match events accurately
- [ ] **AC-1.5**: Time window configurations apply correctly to conversion calculations

### AC-2: Analytics Accuracy
- [ ] **AC-2.1**: Conversion rate calculations are mathematically correct
- [ ] **AC-2.2**: Drop-off analysis identifies the correct bottleneck steps
- [ ] **AC-2.3**: Cohort analysis groups users correctly by entry criteria
- [ ] **AC-2.4**: Segment analysis filters and aggregates data correctly
- [ ] **AC-2.5**: Time-to-conversion metrics calculate accurate percentiles

### AC-3: Performance Requirements
- [ ] **AC-3.1**: Simple analytics queries respond within 200ms (p50)
- [ ] **AC-3.2**: Complex reports complete within 2 seconds (p95)
- [ ] **AC-3.3**: System handles 100 concurrent funnel analysis requests
- [ ] **AC-3.4**: Caching reduces database load by 70% for repeated queries
- [ ] **AC-3.5**: Real-time tracking updates within 30 seconds of event ingestion

### AC-4: Real-time Capabilities
- [ ] **AC-4.1**: User progression updates in real-time as events occur
- [ ] **AC-4.2**: Live conversion metrics refresh automatically
- [ ] **AC-4.3**: Bottleneck detection identifies issues within 5 minutes
- [ ] **AC-4.4**: Alert notifications trigger within 1 minute of threshold breach
- [ ] **AC-4.5**: Dashboard displays accurate real-time funnel health status

### AC-5: Integration & Compatibility
- [ ] **AC-5.1**: All endpoints integrate with existing API key authentication
- [ ] **AC-5.2**: Multi-tenant isolation prevents data leakage between workspaces
- [ ] **AC-5.3**: Rate limiting protects system resources appropriately
- [ ] **AC-5.4**: Export functionality works with existing infrastructure
- [ ] **AC-5.5**: Logging and monitoring integrate with existing observability stack

## Dependencies & Assumptions

### Dependencies
- **DEP-1**: Existing AnalyticsModule and infrastructure components
- **DEP-2**: Prisma ORM with funnel-related database schema
- **DEP-3**: Redis caching infrastructure for performance optimization
- **DEP-4**: Event ingestion system for real-time data processing
- **DEP-5**: API key authentication system with scope extensions

### Assumptions
- **ASS-1**: Event ingestion system provides events in near real-time (< 30s delay)
- **ASS-2**: Database can handle increased query load from funnel analytics
- **ASS-3**: Users will configure reasonable time windows (not exceeding 90 days)
- **ASS-4**: Event volumes will not exceed 1M events/hour per workspace
- **ASS-5**: Funnel configurations will typically have 2-10 steps

## Definition of Done

### Technical Completion Criteria
- [ ] All endpoints implemented with comprehensive error handling
- [ ] Unit tests achieve >90% code coverage for business logic
- [ ] Integration tests cover all major user workflows
- [ ] Performance tests validate response time requirements
- [ ] Security testing confirms multi-tenant isolation
- [ ] Documentation includes API specifications and usage examples

### Quality Assurance Criteria
- [ ] Code review completed by senior developer
- [ ] Security review completed with no critical findings
- [ ] Performance review confirms scalability requirements
- [ ] User acceptance testing completed successfully
- [ ] Load testing demonstrates system stability under peak usage

### Deployment Criteria
- [ ] Database migrations tested in staging environment
- [ ] Feature flags configured for gradual rollout
- [ ] Monitoring alerts configured for production deployment
- [ ] Rollback procedures documented and tested
- [ ] Production deployment completed without issues

## Risk Assessment & Mitigation

### High-Risk Items
- **RISK-1**: Complex funnel calculations may impact database performance
  - **Mitigation**: Implement progressive calculation optimization and monitoring
- **RISK-2**: Real-time processing may introduce system latency
  - **Mitigation**: Design asynchronous processing with fallback mechanisms
- **RISK-3**: Large funnel configurations may exceed response size limits
  - **Mitigation**: Implement pagination and data compression strategies

### Medium-Risk Items  
- **RISK-4**: Cache invalidation complexity may cause data inconsistencies
  - **Mitigation**: Implement robust cache invalidation patterns with verification
- **RISK-5**: Multi-path funnel logic may introduce calculation errors
  - **Mitigation**: Extensive testing with complex funnel scenarios

### Monitoring & Contingency Plans
- **PLAN-1**: Monitor query performance and implement automatic query optimization
- **PLAN-2**: Implement feature flags for quick rollback of problematic features
- **PLAN-3**: Maintain detailed logging for troubleshooting complex issues
- **PLAN-4**: Prepare database optimization scripts for performance issues

## Success Metrics

### Technical Metrics
- API response time p50 < 200ms, p95 < 2s
- System availability > 99.9% during business hours
- Cache hit ratio > 70% for analytics queries
- Zero critical security vulnerabilities
- Database query efficiency improved by 50% over baseline

### Business Metrics
- Customer adoption of funnel features > 80% within 30 days
- Customer satisfaction score > 4.5/5 for funnel analytics
- Support ticket volume related to funnel features < 2% of total
- Feature usage growth > 25% month-over-month
- Customer retention improvement of 10% for funnel users

## Implementation Timeline

### Week 1: Foundation & Configuration
- Set up FunnelAnalyticsModule structure
- Implement funnel CRUD endpoints
- Create funnel versioning system
- Unit tests for configuration management

### Week 2: Core Analytics Engine  
- Implement conversion rate calculations
- Build drop-off analysis functionality
- Create cohort analysis system
- Integration tests for analytics accuracy

### Week 3: Real-time & Advanced Features
- Implement real-time tracking system
- Build bottleneck detection algorithms
- Create multi-path funnel support
- Performance optimization and caching

### Week 4: Integration & Polish
- Complete attribution analysis features
- Implement export functionality
- Performance testing and optimization
- Final integration testing and documentation