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
  HttpCode,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'
import { HybridAuthGuard, HybridTenantContext } from '../../common/auth/hybrid-auth.guard'
import { WorkspaceService } from '../services/workspace.service'
import { CreateWorkspaceDto } from '../dto/create-workspace.dto'
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto'
import { WorkspaceResponseDto, WorkspaceListResponseDto } from '../dto/workspace-response.dto'
import { WorkspaceQueryDto } from '../dto/workspace-query.dto'

@ApiTags('Workspaces')
@ApiBearerAuth()
@ApiSecurity('api-key')
@Controller('v1/tenants/:tenantId/workspaces')
@UseGuards(HybridAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @ApiOperation({
    summary: 'List tenant workspaces',
    description:
      'Retrieve a paginated list of workspaces for a specific tenant. Users can only see workspaces they have access to. API keys can only see their own workspace.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspaces retrieved successfully',
    type: WorkspaceListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this tenant',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term for workspace name or description',
  })
  @ApiQuery({
    name: 'environment',
    required: false,
    enum: ['production', 'staging', 'development', 'test'],
    description: 'Filter by environment type',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'createdAt'],
    description: 'Sort field (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiQuery({
    name: 'includeStats',
    required: false,
    type: Boolean,
    description: 'Include workspace statistics (default: false)',
  })
  @ApiQuery({
    name: 'includeTenant',
    required: false,
    type: Boolean,
    description: 'Include parent tenant information (default: false)',
  })
  async findAll(
    @Param('tenantId') tenantId: string,
    @Query() query: WorkspaceQueryDto,
    @Req() request: FastifyRequest
  ): Promise<WorkspaceListResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.findAll(tenantId, context, query)
  }

  @Get(':workspaceId')
  @ApiOperation({
    summary: 'Get workspace by ID',
    description:
      'Retrieve detailed information about a specific workspace within a tenant. Users can only access workspaces they have permissions for.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace details retrieved successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this workspace',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<WorkspaceResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.findOne(tenantId, workspaceId, context)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new workspace',
    description:
      'Create a new workspace within a tenant. Admin and editor users can create workspaces. API keys cannot create workspaces.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin and editor users can create workspaces',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Workspace name already exists within tenant',
  })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @Req() request: FastifyRequest
  ): Promise<WorkspaceResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.create(tenantId, createWorkspaceDto, context)
  }

  @Patch(':workspaceId')
  @ApiOperation({
    summary: 'Update workspace',
    description:
      'Update workspace information within a tenant. Admin and editor users can update workspaces. API keys cannot update workspaces.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace updated successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to update workspace',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Workspace name already exists within tenant',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @Req() request: FastifyRequest
  ): Promise<WorkspaceResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.update(tenantId, workspaceId, updateWorkspaceDto, context)
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete workspace',
    description:
      'Delete a workspace and all its associated data within a tenant. Only admin users can delete workspaces. Workspaces with active data cannot be deleted.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Workspace deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Workspace "Production Environment" deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can delete workspaces',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Workspace contains active data and cannot be deleted',
  })
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<{ message: string }> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.delete(tenantId, workspaceId, context)
  }

  @Get(':workspaceId/data-impact')
  @ApiOperation({
    summary: 'Get workspace data impact',
    description:
      'Retrieve data impact information for workspace deletion - shows how many API keys, events, funnels, and users would be affected.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Data impact retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        apiKeys: { type: 'number', example: 4 },
        events: { type: 'number', example: 1250 },
        funnels: { type: 'number', example: 3 },
        users: { type: 'number', example: 15 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this workspace',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  async getDataImpact(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<{
    apiKeys: number
    events: number
    funnels: number
    users: number
  }> {
    const context = request.tenantContext as HybridTenantContext
    return this.workspaceService.getDataImpact(tenantId, workspaceId, context)
  }
}
