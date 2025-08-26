# API CRUD Controllers Sprint - Detailed Task Breakdown

## Executive Summary
This sprint implements comprehensive CRUD controllers for Tenant and Workspace management in the Mercurio API. The implementation follows established patterns from the existing UserManagementController and integrates with the HybridAuthGuard for multi-tenant authorization.

## Technical Architecture Overview
- **Backend Framework**: NestJS with Fastify
- **Authentication**: HybridAuthGuard (API Key + Supabase JWT)
- **Database**: Prisma ORM with PostgreSQL
- **Authorization**: Role-based access control with multi-tenant isolation
- **API Versioning**: v1 REST endpoints following OpenAPI standards

## Sprint Timeline: 5 Days (1 Week)

---

## Day 1-2: Foundation Layer

### Task 1.1: TenantService + DTOs
**Estimated Time**: 1.5 days  
**Dependencies**: None  
**Priority**: High

#### Description
Create a comprehensive TenantService following the established patterns in the codebase. Implement all CRUD operations with proper validation, error handling, and multi-tenant isolation.

#### Acceptance Criteria
- [ ] Create `src/tenants/services/tenant.service.ts` with methods:
  - `findAll(context: HybridTenantContext, options: PaginationOptions)`
  - `findOne(tenantId: string, context: HybridTenantContext)`
  - `create(dto: CreateTenantDto, context: HybridTenantContext)`
  - `update(tenantId: string, dto: UpdateTenantDto, context: HybridTenantContext)`
  - `delete(tenantId: string, context: HybridTenantContext)`
- [ ] Create DTOs in `src/tenants/dto/`:
  - `create-tenant.dto.ts` with class-validator decorators
  - `update-tenant.dto.ts` extending PartialType
  - `tenant-response.dto.ts` with proper field mapping
  - `tenant-query.dto.ts` for pagination and filtering
- [ ] Implement proper error handling with custom exceptions
- [ ] Add structured logging with Pino JSON format
- [ ] Ensure all database operations use Prisma with transaction support
- [ ] Include proper BigInt to string conversion for external IDs

#### Technical Requirements
- Use class-validator for all DTOs with comprehensive validation rules
- Follow existing service patterns from UserMappingService
- Implement proper multi-tenant isolation checks
- Use structured error messages with localization support
- Add performance monitoring for database queries

#### Files to Create/Modify
- `src/tenants/services/tenant.service.ts`
- `src/tenants/dto/create-tenant.dto.ts`
- `src/tenants/dto/update-tenant.dto.ts`
- `src/tenants/dto/tenant-response.dto.ts`
- `src/tenants/dto/tenant-query.dto.ts`
- `src/tenants/tenants.module.ts`

---

### Task 1.2: WorkspaceService + DTOs
**Estimated Time**: 1.5 days  
**Dependencies**: Task 1.1 completion  
**Priority**: High

#### Description
Create WorkspaceService with full CRUD operations, ensuring proper tenant-workspace relationships and inheritance of tenant permissions.

#### Acceptance Criteria
- [ ] Create `src/workspaces/services/workspace.service.ts` with methods:
  - `findAll(tenantId: string, context: HybridTenantContext, options: PaginationOptions)`
  - `findOne(tenantId: string, workspaceId: string, context: HybridTenantContext)`
  - `create(tenantId: string, dto: CreateWorkspaceDto, context: HybridTenantContext)`
  - `update(tenantId: string, workspaceId: string, dto: UpdateWorkspaceDto, context: HybridTenantContext)`
  - `delete(tenantId: string, workspaceId: string, context: HybridTenantContext)`
- [ ] Create DTOs in `src/workspaces/dto/`:
  - `create-workspace.dto.ts` with tenant relationship validation
  - `update-workspace.dto.ts` with partial updates
  - `workspace-response.dto.ts` with nested tenant information
  - `workspace-query.dto.ts` for filtering and pagination
- [ ] Implement workspace-specific business rules (unique names per tenant)
- [ ] Add cascade delete protection for workspaces with existing data
- [ ] Implement workspace usage statistics for billing

#### Technical Requirements
- Enforce tenant-workspace relationship integrity
- Add workspace-specific validation rules
- Implement soft delete for workspaces with existing data
- Include workspace metrics in response DTOs
- Add workspace template support for future extensibility

#### Files to Create/Modify
- `src/workspaces/services/workspace.service.ts`
- `src/workspaces/dto/create-workspace.dto.ts`
- `src/workspaces/dto/update-workspace.dto.ts`
- `src/workspaces/dto/workspace-response.dto.ts`
- `src/workspaces/dto/workspace-query.dto.ts`
- `src/workspaces/workspaces.module.ts`

---

### Task 1.3: Database Migrations Review
**Estimated Time**: 0.5 days  
**Dependencies**: None  
**Priority**: Medium

#### Description
Review existing database schema and create any necessary migrations for enhanced tenant/workspace management features.

#### Acceptance Criteria
- [ ] Review current Prisma schema for tenant/workspace tables
- [ ] Create migration for tenant metadata fields if needed:
  - `settings` JSON field for tenant-specific configurations
  - `plan` field for subscription tier tracking
  - `limits` JSON field for tenant-specific limits
- [ ] Create indexes for performance optimization:
  - Composite index on (tenantId, createdAt) for both tables
  - Search index on tenant/workspace names
- [ ] Add database constraints for business rules
- [ ] Update Prisma schema with new fields and constraints

#### Technical Requirements
- Use proper Prisma migration workflow
- Ensure migrations are reversible
- Add proper database constraints
- Include performance considerations for large datasets
- Test migrations with existing test data

#### Files to Create/Modify
- `prisma/migrations/[timestamp]_enhance_tenant_workspace/migration.sql`
- `prisma/schema.prisma` (if needed)

---

## Day 3-4: Controllers Implementation

### Task 2.1: TenantController Endpoints
**Estimated Time**: 1.5 days  
**Dependencies**: Task 1.1  
**Priority**: High

#### Description
Implement comprehensive TenantController with full REST API endpoints, following OpenAPI standards and integrating with HybridAuthGuard.

#### Acceptance Criteria
- [ ] Create `src/tenants/controllers/tenant.controller.ts` with endpoints:
  - `GET /v1/tenants` - List all tenants (admin only)
  - `GET /v1/tenants/:tenantId` - Get specific tenant
  - `POST /v1/tenants` - Create new tenant (admin only)
  - `PATCH /v1/tenants/:tenantId` - Update tenant
  - `DELETE /v1/tenants/:tenantId` - Delete tenant (admin only)
- [ ] Implement proper authorization checks:
  - Admin users can access all tenants
  - Regular users can only access their assigned tenants
  - API keys are restricted to their tenant scope
- [ ] Add comprehensive OpenAPI documentation with @ApiTags, @ApiOperation, @ApiResponse
- [ ] Implement proper error handling with HTTP status codes
- [ ] Add request/response logging and metrics
- [ ] Include pagination, sorting, and filtering for list endpoints

#### Technical Requirements
- Use @UseGuards(HybridAuthGuard) for authentication
- Implement role-based authorization with custom decorators
- Follow REST API best practices with proper HTTP verbs
- Add comprehensive error responses with standardized format
- Include request validation with class-validator
- Implement rate limiting for creation/deletion operations

#### Files to Create/Modify
- `src/tenants/controllers/tenant.controller.ts`
- `src/tenants/tenants.module.ts`
- `src/app.module.ts` (register TenantsModule)

---

### Task 2.2: WorkspaceController Endpoints
**Estimated Time**: 1.5 days  
**Dependencies**: Task 1.2, Task 2.1  
**Priority**: High

#### Description
Implement WorkspaceController with nested resource patterns and proper tenant scoping.

#### Acceptance Criteria
- [ ] Create `src/workspaces/controllers/workspace.controller.ts` with endpoints:
  - `GET /v1/tenants/:tenantId/workspaces` - List tenant workspaces
  - `GET /v1/tenants/:tenantId/workspaces/:workspaceId` - Get specific workspace
  - `POST /v1/tenants/:tenantId/workspaces` - Create workspace within tenant
  - `PATCH /v1/tenants/:tenantId/workspaces/:workspaceId` - Update workspace
  - `DELETE /v1/tenants/:tenantId/workspaces/:workspaceId` - Delete workspace
- [ ] Implement nested authorization:
  - Verify tenant access before workspace operations
  - Ensure workspace belongs to specified tenant
  - Implement workspace-level permissions
- [ ] Add workspace-specific business logic:
  - Prevent deletion of workspaces with active data
  - Validate workspace name uniqueness within tenant
  - Handle API key invalidation on workspace deletion
- [ ] Include workspace statistics in responses
- [ ] Implement batch operations for efficiency

#### Technical Requirements
- Use nested route parameters with proper validation
- Implement tenant-workspace relationship verification
- Add workspace-specific error handling
- Include cascade deletion warnings
- Implement workspace health checks
- Add workspace backup/restore preparation hooks

#### Files to Create/Modify
- `src/workspaces/controllers/workspace.controller.ts`
- `src/workspaces/workspaces.module.ts`
- `src/app.module.ts` (register WorkspacesModule)

---

### Task 2.3: Authorization Integration
**Estimated Time**: 1 day  
**Dependencies**: Task 2.1, Task 2.2  
**Priority**: High

#### Description
Implement comprehensive role-based access control and workspace-scoped authorization for both controllers.

#### Acceptance Criteria
- [ ] Create authorization decorators:
  - `@RequireTenantAccess()` for tenant-level operations
  - `@RequireWorkspaceAccess()` for workspace-level operations
  - `@RequireRole(role: string)` for role-based restrictions
- [ ] Implement authorization middleware:
  - Verify user has access to requested tenant/workspace
  - Check role permissions for specific operations
  - Handle API key scope validation
- [ ] Add comprehensive authorization tests:
  - Test admin access to all resources
  - Test user access to assigned resources only
  - Test API key scope restrictions
- [ ] Implement audit logging for all operations
- [ ] Add permission caching for performance

#### Technical Requirements
- Extend HybridAuthGuard functionality with custom decorators
- Implement authorization decision caching
- Add comprehensive audit trail logging
- Create authorization policy engine for complex rules
- Include permission inheritance from tenant to workspace

#### Files to Create/Modify
- `src/common/auth/authorization.decorators.ts`
- `src/common/auth/authorization.middleware.ts`
- `src/common/auth/authorization.service.ts`
- Update controller files with new decorators

---

## Day 5: Testing & Polish

### Task 3.1: Unit Tests
**Estimated Time**: 1.5 days  
**Dependencies**: Task 1.1, Task 1.2  
**Priority**: High

#### Description
Create comprehensive unit tests for both services with full coverage of business logic and error scenarios.

#### Acceptance Criteria
- [ ] Create unit tests for TenantService:
  - Test all CRUD operations
  - Test validation scenarios
  - Test error handling
  - Test multi-tenant isolation
  - Achieve >90% code coverage
- [ ] Create unit tests for WorkspaceService:
  - Test tenant-workspace relationships
  - Test business rule validation
  - Test cascade delete scenarios
  - Test permission inheritance
  - Achieve >90% code coverage
- [ ] Mock all external dependencies (Prisma, logging, etc.)
- [ ] Test edge cases and boundary conditions
- [ ] Include performance testing for critical operations

#### Technical Requirements
- Use Jest with proper mocking strategies
- Follow testing patterns from existing codebase
- Include both positive and negative test scenarios
- Test async operations with proper error handling
- Add performance benchmarks for critical paths

#### Files to Create/Modify
- `src/tenants/services/tenant.service.spec.ts`
- `src/workspaces/services/workspace.service.spec.ts`
- `src/tenants/__tests__/tenant-service.test.ts`
- `src/workspaces/__tests__/workspace-service.test.ts`

---

### Task 3.2: Integration Tests
**Estimated Time**: 1.5 days  
**Dependencies**: Task 2.1, Task 2.2  
**Priority**: High

#### Description
Create end-to-end integration tests for both controllers covering authentication, authorization, and data flow scenarios.

#### Acceptance Criteria
- [ ] Create integration tests for TenantController:
  - Test all endpoints with different authentication methods
  - Test role-based access control scenarios
  - Test error responses and status codes
  - Test pagination and filtering
- [ ] Create integration tests for WorkspaceController:
  - Test nested resource operations
  - Test tenant-workspace relationship integrity
  - Test authorization across tenant boundaries
  - Test cascade operations
- [ ] Test authentication scenarios:
  - API key authentication with scope validation
  - JWT authentication with role validation
  - Invalid authentication scenarios
- [ ] Include database transaction testing
- [ ] Test concurrent operations and race conditions

#### Technical Requirements
- Use Supertest for HTTP endpoint testing
- Include database setup/teardown for each test
- Test with realistic data volumes
- Include cross-controller integration scenarios
- Test API versioning compatibility

#### Files to Create/Modify
- `src/tenants/controllers/tenant.controller.spec.ts`
- `src/workspaces/controllers/workspace.controller.spec.ts`
- `test/integration/tenant-workspace-crud.test.ts`
- `test/e2e/tenant-management.e2e.test.ts`

---

### Task 3.3: Security Validation
**Estimated Time**: 0.5 days  
**Dependencies**: Task 3.1, Task 3.2  
**Priority**: Critical

#### Description
Perform comprehensive security validation and multi-tenant isolation testing to ensure no data leakage between tenants.

#### Acceptance Criteria
- [ ] Validate multi-tenant data isolation:
  - Test user cannot access other tenant's data
  - Test API keys cannot access other workspace data
  - Test admin users have proper scope limitations
- [ ] Perform security penetration testing:
  - Test SQL injection vulnerabilities
  - Test authorization bypass attempts
  - Test input validation edge cases
- [ ] Validate audit logging completeness:
  - All operations are properly logged
  - Sensitive data is not logged
  - Audit trail includes sufficient context
- [ ] Test rate limiting and DDoS protection
- [ ] Validate error message information disclosure

#### Technical Requirements
- Use automated security scanning tools
- Include manual security review
- Test with malicious input patterns
- Validate all authorization decision points
- Include compliance check for data privacy requirements

#### Files to Create/Modify
- `test/security/tenant-isolation.test.ts`
- `test/security/authorization-bypass.test.ts`
- `docs/security/tenant-workspace-security-review.md`

---

## Dependencies and Risk Assessment

### External Dependencies
- **Prisma ORM**: Database operations and schema management
- **HybridAuthGuard**: Authentication and authorization
- **class-validator**: DTO validation
- **NestJS Framework**: Controller and service implementation

### Technical Risks
1. **Multi-tenant Data Isolation**: Risk of data leakage between tenants
   - Mitigation: Comprehensive testing and audit trail implementation
2. **Performance Impact**: Additional authorization checks may impact performance
   - Mitigation: Implement caching and optimization strategies
3. **Database Migration Complexity**: Schema changes may affect existing data
   - Mitigation: Thorough testing with production data copies

### Implementation Risks
1. **Breaking Changes**: New controllers may conflict with existing patterns
   - Mitigation: Follow established codebase patterns exactly
2. **Authentication Integration**: Complex interaction with HybridAuthGuard
   - Mitigation: Extensive integration testing with both auth methods

---

## Definition of Done

A task is considered complete when:

1. **Functionality**: All acceptance criteria are met and verified
2. **Code Quality**: Code passes all lint checks and follows established patterns
3. **Testing**: Unit tests achieve >90% coverage, integration tests pass
4. **Documentation**: API endpoints documented with OpenAPI specs
5. **Security**: Multi-tenant isolation verified, no security vulnerabilities
6. **Performance**: No performance regressions, response times within SLAs
7. **Review**: Code reviewed by senior team member
8. **Deployment**: Changes deployable without breaking existing functionality

## Success Metrics

- **API Coverage**: 100% CRUD operations implemented for both entities
- **Test Coverage**: >90% code coverage for all new code
- **Performance**: <200ms response time for standard operations
- **Security**: Zero data leakage between tenants
- **Documentation**: 100% API endpoint documentation coverage
- **Error Handling**: Comprehensive error scenarios covered

---

## Files Created/Modified Summary

### New Files (16 total)
**Services & DTOs (8 files)**
- `src/tenants/services/tenant.service.ts`
- `src/tenants/dto/create-tenant.dto.ts`
- `src/tenants/dto/update-tenant.dto.ts`
- `src/tenants/dto/tenant-response.dto.ts`
- `src/tenants/dto/tenant-query.dto.ts`
- `src/workspaces/services/workspace.service.ts`
- `src/workspaces/dto/create-workspace.dto.ts`
- `src/workspaces/dto/update-workspace.dto.ts`
- `src/workspaces/dto/workspace-response.dto.ts`
- `src/workspaces/dto/workspace-query.dto.ts`

**Controllers (2 files)**
- `src/tenants/controllers/tenant.controller.ts`
- `src/workspaces/controllers/workspace.controller.ts`

**Modules (2 files)**
- `src/tenants/tenants.module.ts`
- `src/workspaces/workspaces.module.ts`

**Authorization (3 files)**
- `src/common/auth/authorization.decorators.ts`
- `src/common/auth/authorization.middleware.ts`
- `src/common/auth/authorization.service.ts`

**Tests (8 files)**
- `src/tenants/services/tenant.service.spec.ts`
- `src/workspaces/services/workspace.service.spec.ts`
- `src/tenants/controllers/tenant.controller.spec.ts`
- `src/workspaces/controllers/workspace.controller.spec.ts`
- `test/integration/tenant-workspace-crud.test.ts`
- `test/e2e/tenant-management.e2e.test.ts`
- `test/security/tenant-isolation.test.ts`
- `test/security/authorization-bypass.test.ts`

### Modified Files (3 total)
- `src/app.module.ts` (register new modules)
- `prisma/schema.prisma` (if enhancements needed)
- Database migration files (if needed)

This comprehensive task breakdown ensures systematic implementation of robust, secure, and well-tested CRUD controllers for Tenant and Workspace management, following all established patterns and maintaining the highest quality standards of the Mercurio platform.