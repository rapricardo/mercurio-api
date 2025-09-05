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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { HybridAuthGuard, HybridTenantContext } from '../../common/auth/hybrid-auth.guard';
import { ApiKeyService } from '../../common/auth/api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyDto } from '../dto/update-api-key.dto';
import { ApiKeyQueryDto } from '../dto/api-key-query.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto, ApiKeyListResponseDto } from '../dto/api-key-response.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@ApiSecurity('api-key')
@Controller('v1/tenants/:tenantId/workspaces/:workspaceId/api-keys')
@UseGuards(HybridAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace API keys',
    description: 'Retrieve a paginated list of API keys for a specific workspace. Users can see all workspace API keys they have access to. API keys can only see themselves.',
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
    description: 'API keys retrieved successfully',
    type: ApiKeyListResponseDto,
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
    description: 'Search term for API key name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'revoked', 'all'],
    description: 'Filter by API key status (default: active)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'createdAt', 'lastUsedAt'],
    description: 'Sort field (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    type: String,
    description: 'Filter by specific scope (e.g., events:write)',
  })
  async findAll(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() query: ApiKeyQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<ApiKeyListResponseDto> {
    const context = request.tenantContext as HybridTenantContext;
    return this.apiKeyService.findApiKeys(tenantId, workspaceId, query, context);
  }

  @Get(':apiKeyId')
  @ApiOperation({
    summary: 'Get API key by ID',
    description: 'Retrieve detailed information about a specific API key within a workspace. Users can access API keys in workspaces they have permissions for. API keys can only access themselves.',
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
  @ApiParam({
    name: 'apiKeyId',
    type: 'string',
    description: 'API Key ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'API key details retrieved successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this API key',
  })
  @ApiResponse({
    status: 404,
    description: 'API key, workspace or tenant not found',
  })
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Req() request: FastifyRequest,
  ): Promise<ApiKeyResponseDto> {
    const context = request.tenantContext as HybridTenantContext;
    return this.apiKeyService.findApiKeyById(tenantId, workspaceId, apiKeyId, context);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new API key',
    description: 'Create a new API key within a workspace. Only admin and editor users can create API keys. API keys cannot create other API keys. Returns the full API key only during creation.',
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
    status: 201,
    description: 'API key created successfully',
    type: CreateApiKeyResponseDto,
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
    description: 'Forbidden - Only admin and editor users can create API keys',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - API key name already exists within workspace',
  })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
    @Req() request: FastifyRequest,
  ): Promise<CreateApiKeyResponseDto> {
    const context = request.tenantContext as HybridTenantContext;
    return this.apiKeyService.createApiKey(tenantId, workspaceId, createApiKeyDto, context);
  }

  @Patch(':apiKeyId')
  @ApiOperation({
    summary: 'Update API key',
    description: 'Update API key information within a workspace. Only admin and editor users can update API keys. API keys cannot update themselves.',
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
  @ApiParam({
    name: 'apiKeyId',
    type: 'string',
    description: 'API Key ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyResponseDto,
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
    description: 'Forbidden - Insufficient permissions to update API key',
  })
  @ApiResponse({
    status: 404,
    description: 'API key, workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - API key name already exists within workspace',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @Req() request: FastifyRequest,
  ): Promise<ApiKeyResponseDto> {
    const context = request.tenantContext as HybridTenantContext;
    return this.apiKeyService.updateApiKey(tenantId, workspaceId, apiKeyId, updateApiKeyDto, context);
  }

  @Delete(':apiKeyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Revoke (soft delete) an API key within a workspace. Only admin and editor users can revoke API keys. API keys cannot revoke themselves. Revoked keys become inactive immediately.',
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
  @ApiParam({
    name: 'apiKeyId',
    type: 'string',
    description: 'API Key ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'API key revoked successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'API key "Production Analytics Key" revoked successfully',
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
    description: 'Forbidden - Only admin and editor users can revoke API keys',
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found, workspace or tenant not found, or API key already revoked',
  })
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('apiKeyId') apiKeyId: string,
    @Req() request: FastifyRequest,
  ): Promise<{ message: string }> {
    const context = request.tenantContext as HybridTenantContext;
    return this.apiKeyService.revokeApiKey(tenantId, workspaceId, apiKeyId, context);
  }
}