import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { HybridAuthGuard, HybridTenantContext } from './hybrid-auth.guard'
import { UserMappingService } from './user-mapping.service'
import { PrismaService } from '../../prisma.service'
import { UserStatusDto, PrimaryWorkspaceDto } from './dto/user-status.dto'

interface GrantAccessDto {
  userId: string
  role: 'admin' | 'editor' | 'viewer'
}

interface UpdateRoleDto {
  role: 'admin' | 'editor' | 'viewer'
}

interface WorkspaceUsersResponse {
  users: Array<{
    id: string
    email: string
    name?: string
    role: string
    grantedAt: string
    lastLoginAt?: string
  }>
  total: number
}

interface UserWorkspacesResponse {
  workspaces: Array<{
    tenantId: string
    workspaceId: string
    tenantName: string
    workspaceName: string
    role: string
    grantedAt: string
  }>
  total: number
}

@Controller('v1/auth/users')
@UseGuards(HybridAuthGuard)
export class UserManagementController {
  constructor(
    private readonly userMappingService: UserMappingService,
    private readonly prisma: PrismaService
  ) {}

  @Get('me')
  async getCurrentUser(@Req() request: FastifyRequest) {
    const context = request.tenantContext as HybridTenantContext

    if (context.authType === 'api_key') {
      return {
        authType: 'api_key',
        tenantId: context.tenantId.toString(),
        workspaceId: context.workspaceId.toString(),
        scopes: context.scopes,
      }
    }

    return {
      authType: 'supabase_jwt',
      user: {
        id: context.userId,
        email: context.userEmail,
        role: context.userRole,
      },
      currentWorkspace: {
        tenantId: context.tenantId.toString(),
        workspaceId: context.workspaceId.toString(),
      },
      workspaceAccess:
        context.workspaceAccess?.map((access) => ({
          tenantId: access.tenantId.toString(),
          workspaceId: access.workspaceId.toString(),
          role: access.role,
        })) || [],
      scopes: context.scopes,
    }
  }

  @Get('me/status')
  async getUserStatus(@Req() request: FastifyRequest): Promise<UserStatusDto> {
    const context = request.tenantContext as HybridTenantContext

    // Handle API key authentication
    if (context.authType === 'api_key') {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        include: { tenant: true },
      })

      return {
        needsOnboarding: false,
        hasWorkspaces: true,
        workspaceCount: 1,
        authStatus: 'api_key',
        primaryWorkspace: workspace
          ? {
              tenantId: workspace.tenantId.toString(),
              workspaceId: workspace.id.toString(),
              tenantName: workspace.tenant.name,
              workspaceName: workspace.name,
              role: 'api_key',
              grantedAt: new Date().toISOString(),
            }
          : undefined,
      }
    }

    // Handle JWT authentication - user must be authenticated to reach this point
    if (!context.userId) {
      return {
        needsOnboarding: true,
        hasWorkspaces: false,
        workspaceCount: 0,
        authStatus: 'authenticated',
      }
    }

    // Get user profile and workspace access
    const [userProfile, workspaceAccess] = await Promise.all([
      this.prisma.userProfile.findUnique({
        where: { id: context.userId },
      }),
      this.prisma.userWorkspaceAccess.findMany({
        where: {
          userId: context.userId,
          revokedAt: null,
        },
        include: {
          workspace: {
            include: { tenant: true },
          },
        },
        orderBy: { grantedAt: 'asc' },
      }),
    ])

    const hasWorkspaces = workspaceAccess.length > 0

    // Determine primary workspace (first one granted, usually from onboarding)
    let primaryWorkspace: PrimaryWorkspaceDto | undefined
    if (hasWorkspaces && workspaceAccess[0]) {
      const access = workspaceAccess[0]
      primaryWorkspace = {
        tenantId: access.tenantId.toString(),
        workspaceId: access.workspaceId.toString(),
        tenantName: access.workspace.tenant.name,
        workspaceName: access.workspace.name,
        role: access.role,
        grantedAt: access.grantedAt.toISOString(),
      }
    }

    return {
      needsOnboarding: !hasWorkspaces,
      hasWorkspaces,
      workspaceCount: workspaceAccess.length,
      authStatus: 'authenticated',
      primaryWorkspace,
      user: userProfile
        ? {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name || undefined,
            lastLoginAt: userProfile.lastLoginAt?.toISOString(),
          }
        : {
            id: context.userId,
            email: context.userEmail || 'unknown@example.com',
          },
    }
  }

  @Get('me/workspaces')
  async getUserWorkspaces(@Req() request: FastifyRequest): Promise<UserWorkspacesResponse> {
    const context = request.tenantContext as HybridTenantContext

    if (context.authType === 'api_key') {
      // API keys are bound to a single workspace
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        include: { tenant: true },
      })

      return {
        workspaces: workspace
          ? [
              {
                tenantId: workspace.tenantId.toString(),
                workspaceId: workspace.id.toString(),
                tenantName: workspace.tenant.name,
                workspaceName: workspace.name,
                role: 'api_key',
                grantedAt: new Date().toISOString(),
              },
            ]
          : [],
        total: workspace ? 1 : 0,
      }
    }

    if (!context.userId) {
      return { workspaces: [], total: 0 }
    }

    const userAccess = await this.prisma.userWorkspaceAccess.findMany({
      where: {
        userId: context.userId,
        revokedAt: null,
      },
      include: {
        workspace: {
          include: { tenant: true },
        },
      },
      orderBy: { grantedAt: 'asc' },
    })

    const workspaces = userAccess.map((access) => ({
      tenantId: access.tenantId.toString(),
      workspaceId: access.workspaceId.toString(),
      tenantName: access.workspace.tenant.name,
      workspaceName: access.workspace.name,
      role: access.role,
      grantedAt: access.grantedAt.toISOString(),
    }))

    return { workspaces, total: workspaces.length }
  }

  @Get('workspace/:workspaceId/users')
  async getWorkspaceUsers(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<WorkspaceUsersResponse> {
    const context = request.tenantContext as HybridTenantContext
    const workspaceIdBigInt = BigInt(workspaceId)

    // Ensure user has access to this workspace
    if (context.workspaceId !== workspaceIdBigInt) {
      // For JWT auth, check if user has access to requested workspace
      if (context.authType === 'supabase_jwt') {
        const hasAccess = context.workspaceAccess?.some(
          (access) => access.workspaceId === workspaceIdBigInt
        )
        if (!hasAccess) {
          throw new Error('No access to requested workspace')
        }
      } else {
        throw new Error('API key cannot access different workspace')
      }
    }

    // Only admins can view all workspace users
    if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
      throw new Error('Only admins can view workspace users')
    }

    const limitNum = parseInt(limit || '50')
    const offsetNum = parseInt(offset || '0')

    const [users, total] = await Promise.all([
      this.prisma.userWorkspaceAccess.findMany({
        where: {
          workspaceId: workspaceIdBigInt,
          revokedAt: null,
        },
        include: {
          user: true,
        },
        orderBy: { grantedAt: 'asc' },
        take: limitNum,
        skip: offsetNum,
      }),
      this.prisma.userWorkspaceAccess.count({
        where: {
          workspaceId: workspaceIdBigInt,
          revokedAt: null,
        },
      }),
    ])

    const usersList = users.map((access) => ({
      id: access.user.id,
      email: access.user.email,
      name: access.user.name || undefined,
      role: access.role,
      grantedAt: access.grantedAt.toISOString(),
      lastLoginAt: access.user.lastLoginAt?.toISOString(),
    }))

    return { users: usersList, total }
  }

  @Post('workspace/:workspaceId/users')
  async grantWorkspaceAccess(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: GrantAccessDto,
    @Req() request: FastifyRequest
  ) {
    const context = request.tenantContext as HybridTenantContext
    const workspaceIdBigInt = BigInt(workspaceId)

    // Only admins can grant access
    if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
      throw new Error('Only admins can grant workspace access')
    }

    // API keys cannot grant access
    if (context.authType === 'api_key') {
      throw new Error('API keys cannot grant workspace access')
    }

    const success = await this.userMappingService.grantWorkspaceAccess(
      dto.userId,
      context.tenantId,
      workspaceIdBigInt,
      dto.role,
      context.userId
    )

    if (!success) {
      throw new Error('Failed to grant workspace access')
    }

    return {
      message: 'Workspace access granted successfully',
      userId: dto.userId,
      workspaceId,
      role: dto.role,
    }
  }

  @Patch('workspace/:workspaceId/users/:userId')
  async updateUserRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @Req() request: FastifyRequest
  ) {
    const context = request.tenantContext as HybridTenantContext
    const workspaceIdBigInt = BigInt(workspaceId)

    // Only admins can update roles
    if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
      throw new Error('Only admins can update user roles')
    }

    // API keys cannot update roles
    if (context.authType === 'api_key') {
      throw new Error('API keys cannot update user roles')
    }

    const success = await this.userMappingService.updateUserRole(
      userId,
      context.tenantId,
      workspaceIdBigInt,
      dto.role
    )

    if (!success) {
      throw new Error('Failed to update user role')
    }

    return {
      message: 'User role updated successfully',
      userId,
      workspaceId,
      role: dto.role,
    }
  }

  @Delete('workspace/:workspaceId/users/:userId')
  async revokeWorkspaceAccess(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() request: FastifyRequest
  ) {
    const context = request.tenantContext as HybridTenantContext
    const workspaceIdBigInt = BigInt(workspaceId)

    // Only admins can revoke access
    if (context.authType === 'supabase_jwt' && context.userRole !== 'admin') {
      throw new Error('Only admins can revoke workspace access')
    }

    // API keys cannot revoke access
    if (context.authType === 'api_key') {
      throw new Error('API keys cannot revoke workspace access')
    }

    // Prevent self-removal of admin users
    if (context.userId === userId && context.userRole === 'admin') {
      throw new Error('Admins cannot revoke their own access')
    }

    const success = await this.userMappingService.revokeWorkspaceAccess(
      userId,
      context.tenantId,
      workspaceIdBigInt
    )

    if (!success) {
      throw new Error('Failed to revoke workspace access')
    }

    return {
      message: 'Workspace access revoked successfully',
      userId,
      workspaceId,
    }
  }
}
