import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MercurioLogger } from '../../common/services/logger.service';
import { MetricsService } from '../../common/services/metrics.service';
import { HybridTenantContext } from '../../common/auth/hybrid-auth.guard';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { WorkspaceResponseDto, WorkspaceListResponseDto } from '../dto/workspace-response.dto';
import { WorkspaceQueryDto } from '../dto/workspace-query.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
  ) {}

  async findAll(
    tenantId: string, 
    context: HybridTenantContext, 
    options: WorkspaceQueryDto
  ): Promise<WorkspaceListResponseDto> {
    const startTime = Date.now();
    
    try {
      const tenantIdBigInt = BigInt(tenantId);
      
      this.logger.log('Listing workspaces', {
        tenantId,
        authType: context.authType,
        userId: context.userId,
        userRole: context.userRole,
        filters: options,
      });

      // Validate tenant access
      await this.validateTenantAccess(tenantIdBigInt, context);

      // Get tenant information first
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
        select: { id: true, name: true, status: true },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      // Build where clause based on filters
      let whereClause: any = {
        tenantId: tenantIdBigInt,
      };

      // Apply authorization filters for non-admin users
      if (context.authType === 'api_key') {
        // API keys can only see their own workspace
        whereClause.id = context.workspaceId;
      } else if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
        // Non-admin users can only see workspaces they have access to
        const userWorkspaceIds = context.workspaceAccess
          ?.filter(access => access.tenantId === tenantIdBigInt)
          ?.map(access => access.workspaceId) || [];
        
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
            tenant: {
              id: tenant.id.toString(),
              name: tenant.name,
              status: tenant.status,
            },
          };
        }
        whereClause.id = { in: userWorkspaceIds };
      }

      // Apply search filters
      if (options.search) {
        whereClause.OR = [
          {
            name: {
              contains: options.search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: options.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (options.environment) {
        whereClause.environment = options.environment;
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

      // Build include clause
      const include: any = {};
      if (options.includeTenant) {
        include.tenant = {
          select: { id: true, name: true, status: true },
        };
      }
      if (options.includeStats) {
        include._count = {
          select: {
            events: true,
            apiKeys: { where: { revokedAt: null } },
            funnels: { where: { archivedAt: null } },
            userWorkspaceAccess: { where: { revokedAt: null } },
          },
        };
        include.events = {
          select: { timestamp: true },
          orderBy: { timestamp: 'desc' },
          take: 1,
        };
      }

      // Execute query with pagination
      const [workspaces, total] = await Promise.all([
        this.prisma.workspace.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: pageSize,
          include: Object.keys(include).length > 0 ? include : undefined,
        }),
        this.prisma.workspace.count({ where: whereClause }),
      ]);

      // Transform to response DTOs
      const data: WorkspaceResponseDto[] = workspaces.map(workspace => {
        const response: WorkspaceResponseDto = {
          id: workspace.id.toString(),
          tenantId: workspace.tenantId.toString(),
          name: workspace.name,
          description: (workspace as any).description || undefined,
          createdAt: workspace.createdAt.toISOString(),
          settings: (workspace as any).settings || undefined,
          environment: (workspace as any).environment || undefined,
          limits: (workspace as any).limits || undefined,
        };

        if (options.includeTenant && (workspace as any).tenant) {
          const tenantData = (workspace as any).tenant;
          response.tenant = {
            id: tenantData.id.toString(),
            name: tenantData.name,
            status: tenantData.status,
          };
        }

        if (options.includeStats && (workspace as any)._count) {
          const count = (workspace as any)._count;
          const events = (workspace as any).events;
          response.stats = {
            totalEvents: count.events,
            totalUsers: count.userWorkspaceAccess,
            totalFunnels: count.funnels,
            totalApiKeys: count.apiKeys,
            lastActivity: events.length > 0 ? events[0].timestamp.toISOString() : undefined,
          };
        }

        return response;
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const response: WorkspaceListResponseDto = {
        data,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
        tenant: {
          id: tenant.id.toString(),
          name: tenant.name,
          status: tenant.status,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('workspace_list_processing_time', processingTime);
      this.metrics.incrementCounter('workspace_list_requests');

      return response;

    } catch (error) {
      this.logger.error('Error listing workspaces', error instanceof Error ? error : new Error(String(error)));
      this.metrics.incrementCounter('workspace_list_errors');
      throw error;
    }
  }

  async findOne(
    tenantId: string, 
    workspaceId: string, 
    context: HybridTenantContext
  ): Promise<WorkspaceResponseDto> {
    const startTime = Date.now();
    
    try {
      const tenantIdBigInt = BigInt(tenantId);
      const workspaceIdBigInt = BigInt(workspaceId);
      
      this.logger.log('Finding workspace by ID', {
        tenantId,
        workspaceId,
        authType: context.authType,
        userId: context.userId,
      });

      // Check authorization
      await this.validateWorkspaceAccess(tenantIdBigInt, workspaceIdBigInt, context);

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceIdBigInt },
        include: {
          tenant: {
            select: { id: true, name: true, status: true },
          },
          _count: {
            select: {
              events: true,
              apiKeys: { where: { revokedAt: null } },
              funnels: { where: { archivedAt: null } },
              userWorkspaceAccess: { where: { revokedAt: null } },
            },
          },
          events: {
            select: { timestamp: true },
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
      }

      // Verify workspace belongs to the specified tenant
      if (workspace.tenantId !== tenantIdBigInt) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found in tenant ${tenantId}`);
      }

      const response: WorkspaceResponseDto = {
        id: workspace.id.toString(),
        tenantId: workspace.tenantId.toString(),
        name: workspace.name,
        description: (workspace as any).description || undefined,
        createdAt: workspace.createdAt.toISOString(),
        settings: (workspace as any).settings || undefined,
        environment: (workspace as any).environment || undefined,
        limits: (workspace as any).limits || undefined,
        tenant: {
          id: (workspace as any).tenant.id.toString(),
          name: (workspace as any).tenant.name,
          status: (workspace as any).tenant.status,
        },
        stats: {
          totalEvents: (workspace as any)._count.events,
          totalUsers: (workspace as any)._count.userWorkspaceAccess,
          totalFunnels: (workspace as any)._count.funnels,
          totalApiKeys: (workspace as any)._count.apiKeys,
          lastActivity: (workspace as any).events.length > 0 
            ? (workspace as any).events[0].timestamp.toISOString() 
            : undefined,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('workspace_get_processing_time', processingTime);
      this.metrics.incrementCounter('workspace_get_requests');

      return response;

    } catch (error) {
      this.logger.error('Error finding workspace', error instanceof Error ? error : new Error(String(error)), { tenantId, workspaceId });
      this.metrics.incrementCounter('workspace_get_errors');
      throw error;
    }
  }

  async create(
    tenantId: string, 
    dto: CreateWorkspaceDto, 
    context: HybridTenantContext
  ): Promise<WorkspaceResponseDto> {
    const startTime = Date.now();

    try {
      const tenantIdBigInt = BigInt(tenantId);
      
      this.logger.log('Creating new workspace', {
        tenantId,
        workspaceName: dto.name,
        authType: context.authType,
        userId: context.userId,
        userRole: context.userRole,
      });

      // Validate tenant access
      await this.validateTenantAccess(tenantIdBigInt, context);

      // Only admin users and editors can create workspaces
      if (context.authType === 'api_key') {
        throw new ForbiddenException('API keys cannot create workspaces');
      }

      if (context.authType === 'supabase_jwt' && !['admin', 'editor'].includes(context.userRole || '')) {
        throw new ForbiddenException('Only admin and editor users can create workspaces');
      }

      // Check if tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      // Check for duplicate workspace names within tenant
      const existingWorkspace = await this.prisma.workspace.findFirst({
        where: { 
          tenantId: tenantIdBigInt,
          name: {
            equals: dto.name.trim(),
            mode: 'insensitive',
          }
        },
      });

      if (existingWorkspace) {
        throw new ConflictException(`Workspace with name "${dto.name}" already exists in this tenant`);
      }

      // Create workspace with transaction
      const workspace = await this.prisma.$transaction(async (tx) => {
        const newWorkspace = await tx.workspace.create({
          data: {
            tenantId: tenantIdBigInt,
            name: dto.name.trim(),
            ...(dto.description && { description: dto.description }),
            ...(dto.settings && { settings: dto.settings }),
            ...(dto.environment && { environment: dto.environment }),
            ...(dto.limits && { limits: dto.limits }),
          },
          include: {
            tenant: {
              select: { id: true, name: true, status: true },
            },
          },
        });

        this.logger.log('Workspace created successfully', {
          workspaceId: newWorkspace.id.toString(),
          workspaceName: newWorkspace.name,
          tenantId: tenantId,
        });

        return newWorkspace;
      });

      const response: WorkspaceResponseDto = {
        id: workspace.id.toString(),
        tenantId: workspace.tenantId.toString(),
        name: workspace.name,
        description: (workspace as any).description || undefined,
        createdAt: workspace.createdAt.toISOString(),
        settings: (workspace as any).settings || undefined,
        environment: (workspace as any).environment || undefined,
        limits: (workspace as any).limits || undefined,
        tenant: {
          id: (workspace as any).tenant.id.toString(),
          name: (workspace as any).tenant.name,
          status: (workspace as any).tenant.status,
        },
        stats: {
          totalEvents: 0,
          totalUsers: 0,
          totalFunnels: 0,
          totalApiKeys: 0,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('workspace_create_processing_time', processingTime);
      this.metrics.incrementCounter('workspace_create_requests');

      return response;

    } catch (error) {
      this.logger.error('Error creating workspace', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
        workspaceName: dto.name,
      });
      this.metrics.incrementCounter('workspace_create_errors');
      throw error;
    }
  }

  async update(
    tenantId: string, 
    workspaceId: string, 
    dto: UpdateWorkspaceDto, 
    context: HybridTenantContext
  ): Promise<WorkspaceResponseDto> {
    const startTime = Date.now();

    try {
      const tenantIdBigInt = BigInt(tenantId);
      const workspaceIdBigInt = BigInt(workspaceId);
      
      this.logger.log('Updating workspace', {
        tenantId,
        workspaceId,
        authType: context.authType,
        userId: context.userId,
        updates: Object.keys(dto),
      });

      // Check authorization
      await this.validateWorkspaceAccess(tenantIdBigInt, workspaceIdBigInt, context);

      // Only admin users and editors can update workspaces
      if (context.authType === 'api_key') {
        throw new ForbiddenException('API keys cannot update workspaces');
      }

      if (context.authType === 'supabase_jwt' && !['admin', 'editor'].includes(context.userRole || '')) {
        throw new ForbiddenException('Only admin and editor users can update workspaces');
      }

      // Check if workspace exists and belongs to tenant
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceIdBigInt },
        include: {
          tenant: {
            select: { id: true, name: true, status: true },
          },
        },
      });

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
      }

      if (existingWorkspace.tenantId !== tenantIdBigInt) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found in tenant ${tenantId}`);
      }

      // Check for duplicate names if name is being updated
      if (dto.name && dto.name.trim() !== existingWorkspace.name) {
        const duplicateWorkspace = await this.prisma.workspace.findFirst({
          where: {
            tenantId: tenantIdBigInt,
            name: {
              equals: dto.name.trim(),
              mode: 'insensitive',
            },
            id: { not: workspaceIdBigInt },
          },
        });

        if (duplicateWorkspace) {
          throw new ConflictException(`Workspace with name "${dto.name}" already exists in this tenant`);
        }
      }

      // Update workspace
      const updatedWorkspace = await this.prisma.workspace.update({
        where: { id: workspaceIdBigInt },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.settings !== undefined && { settings: dto.settings }),
          ...(dto.environment !== undefined && { environment: dto.environment }),
          ...(dto.limits !== undefined && { limits: dto.limits }),
        },
        include: {
          tenant: {
            select: { id: true, name: true, status: true },
          },
          _count: {
            select: {
              events: true,
              apiKeys: { where: { revokedAt: null } },
              funnels: { where: { archivedAt: null } },
              userWorkspaceAccess: { where: { revokedAt: null } },
            },
          },
        },
      });

      const response: WorkspaceResponseDto = {
        id: updatedWorkspace.id.toString(),
        tenantId: updatedWorkspace.tenantId.toString(),
        name: updatedWorkspace.name,
        description: (updatedWorkspace as any).description || undefined,
        createdAt: updatedWorkspace.createdAt.toISOString(),
        settings: (updatedWorkspace as any).settings || undefined,
        environment: (updatedWorkspace as any).environment || undefined,
        limits: (updatedWorkspace as any).limits || undefined,
        tenant: {
          id: (updatedWorkspace as any).tenant.id.toString(),
          name: (updatedWorkspace as any).tenant.name,
          status: (updatedWorkspace as any).tenant.status,
        },
        stats: {
          totalEvents: (updatedWorkspace as any)._count.events,
          totalUsers: (updatedWorkspace as any)._count.userWorkspaceAccess,
          totalFunnels: (updatedWorkspace as any)._count.funnels,
          totalApiKeys: (updatedWorkspace as any)._count.apiKeys,
        },
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('workspace_update_processing_time', processingTime);
      this.metrics.incrementCounter('workspace_update_requests');

      return response;

    } catch (error) {
      this.logger.error('Error updating workspace', error instanceof Error ? error : new Error(String(error)), { tenantId, workspaceId });
      this.metrics.incrementCounter('workspace_update_errors');
      throw error;
    }
  }

  async delete(
    tenantId: string, 
    workspaceId: string, 
    context: HybridTenantContext
  ): Promise<{ message: string }> {
    const startTime = Date.now();

    try {
      const tenantIdBigInt = BigInt(tenantId);
      const workspaceIdBigInt = BigInt(workspaceId);
      
      this.logger.log('Deleting workspace', {
        tenantId,
        workspaceId,
        authType: context.authType,
        userId: context.userId,
      });

      // Only admins can delete workspaces
      if (context.authType !== 'supabase_jwt' || context.userRole !== 'admin') {
        throw new ForbiddenException('Only admin users can delete workspaces');
      }

      // Check if workspace exists and belongs to tenant
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceIdBigInt },
        include: {
          _count: {
            select: {
              events: true,
              apiKeys: { where: { revokedAt: null } },
              funnels: { where: { archivedAt: null } },
              userWorkspaceAccess: { where: { revokedAt: null } },
            },
          },
        },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
      }

      if (workspace.tenantId !== tenantIdBigInt) {
        throw new NotFoundException(`Workspace with ID ${workspaceId} not found in tenant ${tenantId}`);
      }

      // Check if workspace has active data
      const counts = (workspace as any)._count;
      if (counts.events > 0 || counts.funnels > 0 || counts.userWorkspaceAccess > 0 || counts.apiKeys > 0) {
        throw new ConflictException(
          `Cannot delete workspace "${workspace.name}" as it contains active data. ` +
          `Events: ${counts.events}, Funnels: ${counts.funnels}, Users: ${counts.userWorkspaceAccess}, API Keys: ${counts.apiKeys}`
        );
      }

      // Delete workspace (cascade will handle related records)
      await this.prisma.workspace.delete({
        where: { id: workspaceIdBigInt },
      });

      this.logger.log('Workspace deleted successfully', {
        tenantId,
        workspaceId,
        workspaceName: workspace.name,
      });

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('workspace_delete_processing_time', processingTime);
      this.metrics.incrementCounter('workspace_delete_requests');

      return {
        message: `Workspace "${workspace.name}" deleted successfully`,
      };

    } catch (error) {
      this.logger.error('Error deleting workspace', error instanceof Error ? error : new Error(String(error)), { tenantId, workspaceId });
      this.metrics.incrementCounter('workspace_delete_errors');
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

  /**
   * Validate if the current user has access to the specified workspace
   */
  private async validateWorkspaceAccess(tenantId: bigint, workspaceId: bigint, context: HybridTenantContext): Promise<void> {
    if (context.authType === 'api_key') {
      // API keys can only access their own tenant and workspace
      if (context.tenantId !== tenantId || context.workspaceId !== workspaceId) {
        throw new ForbiddenException('API key cannot access different tenant or workspace');
      }
    } else if (context.authType === 'supabase_jwt') {
      // Admin users have access to all workspaces
      if (context.userRole === 'admin') {
        return;
      }

      // Regular users can only access workspaces they have explicit access to
      const hasAccess = context.workspaceAccess?.some(
        access => access.tenantId === tenantId && access.workspaceId === workspaceId
      );
      if (!hasAccess) {
        throw new ForbiddenException('User does not have access to this workspace');
      }
    }
  }
}