import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MercurioLogger } from '../../common/services/logger.service';
import { MetricsService } from '../../common/services/metrics.service';
import { HybridTenantContext } from '../../common/auth/hybrid-auth.guard';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { TenantResponseDto, TenantListResponseDto } from '../dto/tenant-response.dto';
import { TenantQueryDto } from '../dto/tenant-query.dto';

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
  ) {}

  async findAll(
    context: HybridTenantContext, 
    options: TenantQueryDto
  ): Promise<TenantListResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.log('Listing tenants', {
        authType: context.authType,
        userId: context.userId,
        userRole: context.userRole,
        filters: options,
      });

      // Build where clause based on filters and authorization
      let whereClause: any = {};

      // Apply authorization filters
      if (context.authType === 'api_key') {
        // API keys can only see their own tenant
        whereClause.id = context.tenantId;
      } else if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
        // Non-admin users can only see tenants they have access to
        const userWorkspaceIds = context.workspaceAccess?.map(access => access.tenantId) || [];
        if (userWorkspaceIds.length === 0) {
          return {
            data: [],
            pagination: {
              total: 0,
              page: options.page || 1,
              pageSize: options.pageSize || 20,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
        whereClause.id = { in: userWorkspaceIds };
      }
      // Admin users can see all tenants - no additional filtering needed

      // Apply search filters
      if (options.search) {
        whereClause.name = {
          contains: options.search,
          mode: 'insensitive',
        };
      }

      if (options.status) {
        whereClause.status = options.status;
      }

      if (options.plan) {
        whereClause.plan = options.plan;
      }

      // Calculate pagination
      const page = options.page || 1;
      const pageSize = Math.min(options.pageSize || 20, 100);
      const skip = (page - 1) * pageSize;

      // Build order clause
      const orderBy: any = {};
      const sortField = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      orderBy[sortField] = sortOrder;

      // Execute query with pagination
      const [tenants, total] = await Promise.all([
        this.prisma.tenant.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: pageSize,
          include: options.includeStats ? {
            _count: {
              select: {
                workspaces: true,
                events: true,
                userWorkspaceAccess: {
                  where: { revokedAt: null },
                },
              },
            },
            events: {
              select: { timestamp: true },
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          } : undefined,
        }),
        this.prisma.tenant.count({ where: whereClause }),
      ]);

      // Transform to response DTOs
      const data: TenantResponseDto[] = tenants.map(tenant => {
        const response: TenantResponseDto = {
          id: tenant.id.toString(),
          name: tenant.name,
          status: tenant.status,
          createdAt: tenant.createdAt.toISOString(),
          settings: (tenant as any).settings || undefined,
          plan: (tenant as any).plan || undefined,
          limits: (tenant as any).limits || undefined,
        };

        if (options.includeStats && (tenant as any)._count) {
          const count = (tenant as any)._count;
          const events = (tenant as any).events;
          response.stats = {
            totalWorkspaces: count.workspaces,
            totalUsers: count.userWorkspaceAccess,
            totalEvents: count.events,
            lastActivity: events.length > 0 ? events[0].timestamp.toISOString() : undefined,
          };
        }

        return response;
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const response: TenantListResponseDto = {
        data,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('tenant_list_processing_time', processingTime);
      this.metrics.incrementCounter('tenant_list_requests');

      return response;

    } catch (error) {
      this.logger.error('Error listing tenants', error instanceof Error ? error : new Error(String(error)));
      this.metrics.incrementCounter('tenant_list_errors');
      throw error;
    }
  }

  async findOne(tenantId: string, context: HybridTenantContext): Promise<TenantResponseDto> {
    const startTime = Date.now();
    
    try {
      const tenantIdBigInt = BigInt(tenantId);
      
      this.logger.log('Finding tenant by ID', {
        tenantId,
        authType: context.authType,
        userId: context.userId,
      });

      // Check authorization
      await this.validateTenantAccess(tenantIdBigInt, context);

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
        include: {
          _count: {
            select: {
              workspaces: true,
              events: true,
              userWorkspaceAccess: {
                where: { revokedAt: null },
              },
            },
          },
          events: {
            select: { timestamp: true },
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      const response: TenantResponseDto = {
        id: tenant.id.toString(),
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
        settings: (tenant as any).settings || undefined,
        plan: (tenant as any).plan || undefined,
        limits: (tenant as any).limits || undefined,
        stats: {
          totalWorkspaces: (tenant as any)._count.workspaces,
          totalUsers: (tenant as any)._count.userWorkspaceAccess,
          totalEvents: (tenant as any)._count.events,
          lastActivity: (tenant as any).events.length > 0 
            ? (tenant as any).events[0].timestamp.toISOString() 
            : undefined,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('tenant_get_processing_time', processingTime);
      this.metrics.incrementCounter('tenant_get_requests');

      return response;

    } catch (error) {
      this.logger.error('Error finding tenant', error instanceof Error ? error : new Error(String(error)), { tenantId });
      this.metrics.incrementCounter('tenant_get_errors');
      throw error;
    }
  }

  async create(dto: CreateTenantDto, context: HybridTenantContext): Promise<TenantResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.log('Creating new tenant', {
        tenantName: dto.name,
        authType: context.authType,
        userId: context.userId,
        userRole: context.userRole,
      });

      // Only admins can create tenants
      if (context.authType !== 'supabase_jwt' || context.userRole !== 'admin') {
        throw new ForbiddenException('Only admin users can create tenants');
      }

      // Check for duplicate tenant names
      const existingTenant = await this.prisma.tenant.findFirst({
        where: { 
          name: {
            equals: dto.name.trim(),
            mode: 'insensitive',
          }
        },
      });

      if (existingTenant) {
        throw new ConflictException(`Tenant with name "${dto.name}" already exists`);
      }

      // Create tenant with transaction
      const tenant = await this.prisma.$transaction(async (tx) => {
        const newTenant = await tx.tenant.create({
          data: {
            name: dto.name.trim(),
            status: dto.status || 'active',
            ...(dto.settings && { settings: dto.settings }),
            ...(dto.plan && { plan: dto.plan }),
            ...(dto.limits && { limits: dto.limits }),
          },
        });

        this.logger.log('Tenant created successfully', {
          tenantId: newTenant.id.toString(),
          tenantName: newTenant.name,
        });

        return newTenant;
      });

      const response: TenantResponseDto = {
        id: tenant.id.toString(),
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
        settings: (tenant as any).settings || undefined,
        plan: (tenant as any).plan || undefined,
        limits: (tenant as any).limits || undefined,
        stats: {
          totalWorkspaces: 0,
          totalUsers: 0,
          totalEvents: 0,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('tenant_create_processing_time', processingTime);
      this.metrics.incrementCounter('tenant_create_requests');

      return response;

    } catch (error) {
      this.logger.error('Error creating tenant', error instanceof Error ? error : new Error(String(error)), {
        tenantName: dto.name,
      });
      this.metrics.incrementCounter('tenant_create_errors');
      throw error;
    }
  }

  async update(tenantId: string, dto: UpdateTenantDto, context: HybridTenantContext): Promise<TenantResponseDto> {
    const startTime = Date.now();

    try {
      const tenantIdBigInt = BigInt(tenantId);
      
      this.logger.log('Updating tenant', {
        tenantId,
        authType: context.authType,
        userId: context.userId,
        updates: Object.keys(dto),
      });

      // Check authorization
      await this.validateTenantAccess(tenantIdBigInt, context);

      // Only admins can update tenant status and critical fields
      if (context.authType !== 'supabase_jwt' || context.userRole !== 'admin') {
        if (dto.status || dto.plan || dto.limits) {
          throw new ForbiddenException('Only admin users can update tenant status, plan, or limits');
        }
      }

      // Check if tenant exists
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
      });

      if (!existingTenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      // Check for duplicate names if name is being updated
      if (dto.name && dto.name.trim() !== existingTenant.name) {
        const duplicateTenant = await this.prisma.tenant.findFirst({
          where: {
            name: {
              equals: dto.name.trim(),
              mode: 'insensitive',
            },
            id: { not: tenantIdBigInt },
          },
        });

        if (duplicateTenant) {
          throw new ConflictException(`Tenant with name "${dto.name}" already exists`);
        }
      }

      // Update tenant
      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantIdBigInt },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.status && { status: dto.status }),
          ...(dto.settings !== undefined && { settings: dto.settings }),
          ...(dto.plan !== undefined && { plan: dto.plan }),
          ...(dto.limits !== undefined && { limits: dto.limits }),
        },
        include: {
          _count: {
            select: {
              workspaces: true,
              events: true,
              userWorkspaceAccess: {
                where: { revokedAt: null },
              },
            },
          },
        },
      });

      const response: TenantResponseDto = {
        id: updatedTenant.id.toString(),
        name: updatedTenant.name,
        status: updatedTenant.status,
        createdAt: updatedTenant.createdAt.toISOString(),
        settings: (updatedTenant as any).settings || undefined,
        plan: (updatedTenant as any).plan || undefined,
        limits: (updatedTenant as any).limits || undefined,
        stats: {
          totalWorkspaces: (updatedTenant as any)._count.workspaces,
          totalUsers: (updatedTenant as any)._count.userWorkspaceAccess,
          totalEvents: (updatedTenant as any)._count.events,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('tenant_update_processing_time', processingTime);
      this.metrics.incrementCounter('tenant_update_requests');

      return response;

    } catch (error) {
      this.logger.error('Error updating tenant', error instanceof Error ? error : new Error(String(error)), { tenantId });
      this.metrics.incrementCounter('tenant_update_errors');
      throw error;
    }
  }

  async delete(tenantId: string, context: HybridTenantContext): Promise<{ message: string }> {
    const startTime = Date.now();

    try {
      const tenantIdBigInt = BigInt(tenantId);
      
      this.logger.log('Deleting tenant', {
        tenantId,
        authType: context.authType,
        userId: context.userId,
      });

      // Only admins can delete tenants
      if (context.authType !== 'supabase_jwt' || context.userRole !== 'admin') {
        throw new ForbiddenException('Only admin users can delete tenants');
      }

      // Check if tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
        include: {
          _count: {
            select: {
              workspaces: true,
              events: true,
              userWorkspaceAccess: {
                where: { revokedAt: null },
              },
            },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      // Check if tenant has active data
      const counts = (tenant as any)._count;
      if (counts.workspaces > 0 || counts.events > 0 || counts.userWorkspaceAccess > 0) {
        throw new ConflictException(
          `Cannot delete tenant "${tenant.name}" as it contains active data. ` +
          `Workspaces: ${counts.workspaces}, Events: ${counts.events}, Active Users: ${counts.userWorkspaceAccess}`
        );
      }

      // Delete tenant (cascade will handle related records)
      await this.prisma.tenant.delete({
        where: { id: tenantIdBigInt },
      });

      this.logger.log('Tenant deleted successfully', {
        tenantId,
        tenantName: tenant.name,
      });

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('tenant_delete_processing_time', processingTime);
      this.metrics.incrementCounter('tenant_delete_requests');

      return {
        message: `Tenant "${tenant.name}" deleted successfully`,
      };

    } catch (error) {
      this.logger.error('Error deleting tenant', error instanceof Error ? error : new Error(String(error)), { tenantId });
      this.metrics.incrementCounter('tenant_delete_errors');
      throw error;
    }
  }

  /**
   * Validate if the current user has access to the specified tenant
   */
  private async validateTenantAccess(tenantId: bigint, context: HybridTenantContext): Promise<void> {
    if (context.authType === 'api_key') {
      // API keys can only access their own tenant
      if (context.tenantId !== tenantId) {
        throw new ForbiddenException('API key cannot access different tenant');
      }
    } else if (context.authType === 'supabase_jwt') {
      // Admin users have access to all tenants
      if (context.userRole === 'admin') {
        return;
      }

      // Regular users can only access tenants they have workspace access to
      const hasAccess = context.workspaceAccess?.some(access => access.tenantId === tenantId);
      if (!hasAccess) {
        throw new ForbiddenException('User does not have access to this tenant');
      }
    }
  }
}