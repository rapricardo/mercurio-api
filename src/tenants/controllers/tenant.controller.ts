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
import { TenantService } from '../services/tenant.service'
import { CreateTenantDto } from '../dto/create-tenant.dto'
import { UpdateTenantDto } from '../dto/update-tenant.dto'
import { TenantResponseDto, TenantListResponseDto } from '../dto/tenant-response.dto'
import { TenantQueryDto } from '../dto/tenant-query.dto'

@ApiTags('Tenants')
@ApiBearerAuth()
@ApiSecurity('api-key')
@Controller('v1/tenants')
@UseGuards(HybridAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({
    summary: 'List all tenants',
    description:
      'Retrieve a paginated list of tenants. Admin users can see all tenants, while regular users can only see tenants they have access to. API keys can only see their own tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenants retrieved successfully',
    type: TenantListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
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
    description: 'Search term for tenant name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'suspended'],
    description: 'Filter by tenant status',
  })
  @ApiQuery({
    name: 'plan',
    required: false,
    type: String,
    description: 'Filter by subscription plan',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'createdAt', 'status'],
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
    description: 'Include tenant statistics (default: false)',
  })
  async findAll(
    @Query() query: TenantQueryDto,
    @Req() request: FastifyRequest
  ): Promise<TenantListResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.tenantService.findAll(context, query)
  }

  @Get(':tenantId')
  @ApiOperation({
    summary: 'Get tenant by ID',
    description:
      'Retrieve detailed information about a specific tenant. Users can only access tenants they have permissions for.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant details retrieved successfully',
    type: TenantResponseDto,
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
  async findOne(
    @Param('tenantId') tenantId: string,
    @Req() request: FastifyRequest
  ): Promise<TenantResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.tenantService.findOne(tenantId, context)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new tenant',
    description:
      'Create a new tenant. Only admin users can create tenants. API keys cannot create tenants.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: TenantResponseDto,
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
    description: 'Forbidden - Only admin users can create tenants',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Tenant name already exists',
  })
  async create(
    @Body() createTenantDto: CreateTenantDto,
    @Req() request: FastifyRequest
  ): Promise<TenantResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.tenantService.create(createTenantDto, context)
  }

  @Patch(':tenantId')
  @ApiOperation({
    summary: 'Update tenant',
    description:
      'Update tenant information. Admin users can update all fields, while regular users have limited access to certain fields.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully',
    type: TenantResponseDto,
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
    description: 'Forbidden - Insufficient permissions to update tenant',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Tenant name already exists',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @Req() request: FastifyRequest
  ): Promise<TenantResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.tenantService.update(tenantId, updateTenantDto, context)
  }

  @Delete(':tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete tenant',
    description:
      'Delete a tenant and all its associated data. Only admin users can delete tenants. Tenants with active data cannot be deleted.',
  })
  @ApiParam({
    name: 'tenantId',
    type: 'string',
    description: 'Tenant ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Tenant "Acme Corporation" deleted successfully',
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
    description: 'Forbidden - Only admin users can delete tenants',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Tenant contains active data and cannot be deleted',
  })
  async remove(
    @Param('tenantId') tenantId: string,
    @Req() request: FastifyRequest
  ): Promise<{ message: string }> {
    const context = request.tenantContext as HybridTenantContext
    return this.tenantService.delete(tenantId, context)
  }
}
