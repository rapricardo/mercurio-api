import { Injectable, Logger, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { ApiKeyValidationResult, HybridTenantContext } from '../types/tenant-context.type'
import { CacheService } from '../services/cache.service'
import { CreateApiKeyDto } from '../../api-keys/dto/create-api-key.dto'
import { UpdateApiKeyDto } from '../../api-keys/dto/update-api-key.dto'
import { ApiKeyQueryDto } from '../../api-keys/dto/api-key-query.dto'
import { ApiKeyResponseDto, CreateApiKeyResponseDto, ApiKeyListResponseDto } from '../../api-keys/dto/api-key-response.dto'
import crypto from 'node:crypto'

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name)
  private readonly cacheKeyPrefix = 'apikey:'
  private readonly cacheTtlMs = parseInt(process.env.API_KEY_CACHE_TTL || '300000') // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async validateKey(rawApiKey: string): Promise<ApiKeyValidationResult> {
    try {
      // Extract key from format: ak_xxxxx
      if (!rawApiKey.startsWith('ak_')) {
        return { isValid: false, scopes: [] }
      }

      // Hash the key for cache lookup
      const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex')
      const cacheKey = `${this.cacheKeyPrefix}${keyHash}`

      // Check cache first
      const cachedResult = this.cache.get<ApiKeyValidationResult>(cacheKey)
      if (cachedResult) {
        this.logger.debug('API key validation cache hit', { keyHash: keyHash.substring(0, 8) })
        
        // Update last used timestamp asynchronously (fire and forget)
        if (cachedResult.isValid && cachedResult.apiKeyId) {
          this.updateLastUsed(cachedResult.apiKeyId).catch((error) => {
            this.logger.warn('Failed to update API key last used timestamp', { 
              apiKeyId: cachedResult.apiKeyId!.toString(),
              error: error.message 
            })
          })
        }
        
        return cachedResult
      }

      // Cache miss - query database
      this.logger.debug('API key validation cache miss', { keyHash: keyHash.substring(0, 8) })
      
      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          keyHash,
          revokedAt: null, // Not revoked
        },
        include: {
          workspace: {
            include: {
              tenant: true,
            },
          },
        },
      })

      let result: ApiKeyValidationResult

      if (!apiKey) {
        this.logger.warn('Invalid or revoked API key attempted', { keyHash: keyHash.substring(0, 8) })
        result = { isValid: false, scopes: [] }
      } else {
        // Update last used timestamp (fire and forget)
        this.updateLastUsed(apiKey.id).catch((error) => {
          this.logger.warn('Failed to update API key last used timestamp', { 
            apiKeyId: apiKey.id.toString(),
            error: error.message 
          })
        })

        result = {
          isValid: true,
          tenantId: apiKey.workspace.tenantId,
          workspaceId: apiKey.workspaceId,
          apiKeyId: apiKey.id,
          scopes: Array.isArray(apiKey.scopes) ? apiKey.scopes as string[] : [],
          lastUsedAt: apiKey.lastUsedAt || undefined,
        }
      }

      // Cache the result
      this.cache.set(cacheKey, result, this.cacheTtlMs)
      
      return result
    } catch (error) {
      this.logger.error('API key validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return { isValid: false, scopes: [] }
    }
  }

  async updateLastUsed(apiKeyId: bigint): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    })
  }

  async revokeKey(apiKeyId: bigint): Promise<void> {
    // Get the API key to find its hash for cache invalidation
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { keyHash: true },
    })

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    })

    // Invalidate cache entry
    if (apiKey?.keyHash) {
      const cacheKey = `${this.cacheKeyPrefix}${apiKey.keyHash}`
      this.cache.delete(cacheKey)
      this.logger.debug('Invalidated cache for revoked API key', { apiKeyId: apiKeyId.toString() })
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  /**
   * Clear API key cache (for administrative purposes)
   */
  clearCache(): void {
    // Get all cache entries with our prefix
    const entries = this.cache.getEntries()
    let clearedCount = 0

    for (const { key } of entries) {
      if (key.startsWith(this.cacheKeyPrefix)) {
        this.cache.delete(key)
        clearedCount++
      }
    }

    this.logger.log(`Cleared ${clearedCount} API key cache entries`)
  }

  /**
   * Check if API key has required scope
   */
  hasScope(scopes: string[], requiredScope: string): boolean {
    return scopes.includes('*') || scopes.includes(requiredScope)
  }

  /**
   * Check if API key can write events
   */
  canWriteEvents(scopes: string[]): boolean {
    return this.hasScope(scopes, 'write') || this.hasScope(scopes, 'events:write')
  }

  /**
   * Check if API key can read events
   */
  canReadEvents(scopes: string[]): boolean {
    return this.hasScope(scopes, 'read') || this.hasScope(scopes, 'events:read')
  }

  /**
   * Create a new API key for a workspace
   */
  async createApiKey(
    tenantId: string,
    workspaceId: string,
    createApiKeyDto: CreateApiKeyDto,
    context: HybridTenantContext,
  ): Promise<CreateApiKeyResponseDto> {
    try {
      // Only users can create API keys, not other API keys
      if (context.authType !== 'supabase_jwt') {
        throw new ForbiddenException('API keys cannot create other API keys')
      }

      // Check if user has admin or editor permissions
      if (!['admin', 'editor'].includes(context.userRole!)) {
        throw new ForbiddenException('Only admin and editor users can create API keys')
      }

      // Verify workspace exists and user has access
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          id: BigInt(workspaceId),
          tenantId: BigInt(tenantId),
        },
        include: {
          userWorkspaceAccess: {
            where: { userId: context.userId! },
          },
        },
      })

      if (!workspace || workspace.userWorkspaceAccess.length === 0) {
        throw new NotFoundException('Workspace not found or access denied')
      }

      // Check for duplicate name within workspace
      const existingApiKey = await this.prisma.apiKey.findFirst({
        where: {
          workspaceId: BigInt(workspaceId),
          name: createApiKeyDto.name,
          revokedAt: null,
        },
      })

      if (existingApiKey) {
        throw new ConflictException('API key with this name already exists in the workspace')
      }

      // Generate API key
      const apiKey = this.generateApiKey()
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
      const keyPrefix = `${apiKey.substring(0, 11)}...`

      // Set default scopes if not provided
      const scopes = createApiKeyDto.scopes || ['events:write']

      // Create API key in database
      const newApiKey = await this.prisma.apiKey.create({
        data: {
          name: createApiKeyDto.name,
          keyHash,
          scopes,
          workspaceId: BigInt(workspaceId),
        },
      })

      this.logger.log(`API key created`, {
        apiKeyId: newApiKey.id.toString(),
        workspaceId,
        tenantId,
        userId: context.userId,
        name: createApiKeyDto.name,
      })

      return {
        id: newApiKey.id.toString(),
        name: newApiKey.name,
        scopes: newApiKey.scopes as string[],
        keyPrefix,
        workspaceId: newApiKey.workspaceId.toString(),
        lastUsedAt: newApiKey.lastUsedAt || undefined,
        createdAt: newApiKey.createdAt,
        updatedAt: newApiKey.createdAt, // Use createdAt since no updatedAt field exists
        revokedAt: newApiKey.revokedAt,
        status: newApiKey.revokedAt ? 'revoked' : 'active',
        apiKey, // Only returned during creation
      }
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      this.logger.error('Failed to create API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
        tenantId,
        userId: context.userId,
      })
      throw new BadRequestException('Failed to create API key')
    }
  }

  /**
   * List API keys for a workspace with filtering and pagination
   */
  async findApiKeys(
    tenantId: string,
    workspaceId: string,
    query: ApiKeyQueryDto,
    context: HybridTenantContext,
  ): Promise<ApiKeyListResponseDto> {
    try {
      // Verify workspace access
      if (context.authType === 'api_key') {
        // API keys can only see themselves
        if (context.workspaceId !== BigInt(workspaceId)) {
          throw new ForbiddenException('API keys can only access their own workspace')
        }
      } else {
        // Users need workspace access
        const workspace = await this.prisma.workspace.findFirst({
          where: {
            id: BigInt(workspaceId),
            tenantId: BigInt(tenantId),
          },
          include: {
            userWorkspaceAccess: {
              where: { userId: context.userId! },
            },
          },
        })

        if (!workspace || workspace.userWorkspaceAccess.length === 0) {
          throw new NotFoundException('Workspace not found or access denied')
        }
      }

      // Build filters
      const where: any = {
        workspaceId: BigInt(workspaceId),
      }

      // Status filter
      if (query.status === 'active') {
        where.revokedAt = null
      } else if (query.status === 'revoked') {
        where.revokedAt = { not: null }
      }

      // Search filter
      if (query.search) {
        where.name = { contains: query.search, mode: 'insensitive' }
      }

      // Scope filter
      if (query.scope) {
        where.scopes = { has: query.scope }
      }

      // If API key context, only show self
      if (context.authType === 'api_key') {
        where.id = context.apiKeyId!
      }

      // Count total
      const total = await this.prisma.apiKey.count({ where })

      // Calculate pagination
      const totalPages = Math.ceil(total / query.pageSize!)
      const skip = (query.page! - 1) * query.pageSize!

      // Build order by
      const orderBy: any = {}
      orderBy[query.sortBy!] = query.sortOrder!

      // Fetch API keys
      const apiKeys = await this.prisma.apiKey.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
      })

      const data = apiKeys.map(apiKey => {
        const keyPrefix = `ak_${apiKey.keyHash.substring(0, 8)}...`
        return {
          id: apiKey.id.toString(),
          name: apiKey.name,
          scopes: apiKey.scopes as string[],
          keyPrefix,
          workspaceId: apiKey.workspaceId.toString(),
          lastUsedAt: apiKey.lastUsedAt || undefined,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.createdAt, // Use createdAt since no updatedAt field exists
          revokedAt: apiKey.revokedAt,
          status: apiKey.revokedAt ? 'revoked' as const : 'active' as const,
        }
      })

      return {
        data,
        total,
        page: query.page!,
        pageSize: query.pageSize!,
        totalPages,
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      this.logger.error('Failed to fetch API keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workspaceId,
        tenantId,
        userId: context.userId,
      })
      throw new BadRequestException('Failed to fetch API keys')
    }
  }

  /**
   * Get a specific API key by ID
   */
  async findApiKeyById(
    tenantId: string,
    workspaceId: string,
    apiKeyId: string,
    context: HybridTenantContext,
  ): Promise<ApiKeyResponseDto> {
    try {
      // Verify access
      if (context.authType === 'api_key') {
        // API keys can only see themselves
        if (context.apiKeyId !== BigInt(apiKeyId)) {
          throw new ForbiddenException('API keys can only access themselves')
        }
      } else {
        // Users need workspace access
        const workspace = await this.prisma.workspace.findFirst({
          where: {
            id: BigInt(workspaceId),
            tenantId: BigInt(tenantId),
          },
          include: {
            userWorkspaceAccess: {
              where: { userId: context.userId! },
            },
          },
        })

        if (!workspace || workspace.userWorkspaceAccess.length === 0) {
          throw new NotFoundException('Workspace not found or access denied')
        }
      }

      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          id: BigInt(apiKeyId),
          workspaceId: BigInt(workspaceId),
        },
      })

      if (!apiKey) {
        throw new NotFoundException('API key not found')
      }

      const keyPrefix = `ak_${apiKey.keyHash.substring(0, 8)}...`
      
      return {
        id: apiKey.id.toString(),
        name: apiKey.name,
        scopes: apiKey.scopes as string[],
        keyPrefix,
        workspaceId: apiKey.workspaceId.toString(),
        lastUsedAt: apiKey.lastUsedAt || undefined,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.createdAt, // Use createdAt since no updatedAt field exists
        revokedAt: apiKey.revokedAt,
        status: apiKey.revokedAt ? 'revoked' : 'active',
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      this.logger.error('Failed to fetch API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId,
        workspaceId,
        tenantId,
        userId: context.userId,
      })
      throw new BadRequestException('Failed to fetch API key')
    }
  }

  /**
   * Update an API key
   */
  async updateApiKey(
    tenantId: string,
    workspaceId: string,
    apiKeyId: string,
    updateApiKeyDto: UpdateApiKeyDto,
    context: HybridTenantContext,
  ): Promise<ApiKeyResponseDto> {
    try {
      // Only users can update API keys
      if (context.authType !== 'supabase_jwt') {
        throw new ForbiddenException('API keys cannot update themselves')
      }

      // Check permissions
      if (!['admin', 'editor'].includes(context.userRole!)) {
        throw new ForbiddenException('Only admin and editor users can update API keys')
      }

      // Verify workspace access
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          id: BigInt(workspaceId),
          tenantId: BigInt(tenantId),
        },
        include: {
          userWorkspaceAccess: {
            where: { userId: context.userId! },
          },
        },
      })

      if (!workspace || workspace.userWorkspaceAccess.length === 0) {
        throw new NotFoundException('Workspace not found or access denied')
      }

      // Find existing API key
      const existingApiKey = await this.prisma.apiKey.findFirst({
        where: {
          id: BigInt(apiKeyId),
          workspaceId: BigInt(workspaceId),
        },
      })

      if (!existingApiKey) {
        throw new NotFoundException('API key not found')
      }

      // Check for name conflicts if updating name
      if (updateApiKeyDto.name && updateApiKeyDto.name !== existingApiKey.name) {
        const nameConflict = await this.prisma.apiKey.findFirst({
          where: {
            workspaceId: BigInt(workspaceId),
            name: updateApiKeyDto.name,
            revokedAt: null,
            id: { not: BigInt(apiKeyId) },
          },
        })

        if (nameConflict) {
          throw new ConflictException('API key with this name already exists in the workspace')
        }
      }

      // Update API key
      const updatedApiKey = await this.prisma.apiKey.update({
        where: { id: BigInt(apiKeyId) },
        data: {
          ...(updateApiKeyDto.name && { name: updateApiKeyDto.name }),
          ...(updateApiKeyDto.scopes && { scopes: updateApiKeyDto.scopes }),
        },
      })

      // Invalidate cache if key hash exists
      const cacheKey = `${this.cacheKeyPrefix}${existingApiKey.keyHash}`
      this.cache.delete(cacheKey)

      this.logger.log(`API key updated`, {
        apiKeyId: updatedApiKey.id.toString(),
        workspaceId,
        tenantId,
        userId: context.userId,
        changes: updateApiKeyDto,
      })

      const keyPrefix = `ak_${updatedApiKey.keyHash.substring(0, 8)}...`
      
      return {
        id: updatedApiKey.id.toString(),
        name: updatedApiKey.name,
        scopes: updatedApiKey.scopes as string[],
        keyPrefix,
        workspaceId: updatedApiKey.workspaceId.toString(),
        lastUsedAt: updatedApiKey.lastUsedAt || undefined,
        createdAt: updatedApiKey.createdAt,
        updatedAt: updatedApiKey.createdAt, // Use createdAt since no updatedAt field exists
        revokedAt: updatedApiKey.revokedAt,
        status: updatedApiKey.revokedAt ? 'revoked' : 'active',
      }
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      this.logger.error('Failed to update API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId,
        workspaceId,
        tenantId,
        userId: context.userId,
      })
      throw new BadRequestException('Failed to update API key')
    }
  }

  /**
   * Revoke (soft delete) an API key
   */
  async revokeApiKey(
    tenantId: string,
    workspaceId: string,
    apiKeyId: string,
    context: HybridTenantContext,
  ): Promise<{ message: string }> {
    try {
      // Only users can revoke API keys
      if (context.authType !== 'supabase_jwt') {
        throw new ForbiddenException('API keys cannot revoke themselves')
      }

      // Check permissions
      if (!['admin', 'editor'].includes(context.userRole!)) {
        throw new ForbiddenException('Only admin and editor users can revoke API keys')
      }

      // Verify workspace access
      const workspace = await this.prisma.workspace.findFirst({
        where: {
          id: BigInt(workspaceId),
          tenantId: BigInt(tenantId),
        },
        include: {
          userWorkspaceAccess: {
            where: { userId: context.userId! },
          },
        },
      })

      if (!workspace || workspace.userWorkspaceAccess.length === 0) {
        throw new NotFoundException('Workspace not found or access denied')
      }

      // Find and revoke API key
      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          id: BigInt(apiKeyId),
          workspaceId: BigInt(workspaceId),
          revokedAt: null, // Only revoke active keys
        },
      })

      if (!apiKey) {
        throw new NotFoundException('API key not found or already revoked')
      }

      await this.revokeKey(BigInt(apiKeyId))

      this.logger.log(`API key revoked`, {
        apiKeyId,
        workspaceId,
        tenantId,
        userId: context.userId,
        apiKeyName: apiKey.name,
      })

      return {
        message: `API key "${apiKey.name}" revoked successfully`,
      }
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }
      this.logger.error('Failed to revoke API key', {
        error: error instanceof Error ? error.message : 'Unknown error',
        apiKeyId,
        workspaceId,
        tenantId,
        userId: context.userId,
      })
      throw new BadRequestException('Failed to revoke API key')
    }
  }

  /**
   * Generate a new API key string
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(16)
    const key = randomBytes.toString('hex')
    return `ak_${key}`
  }
}