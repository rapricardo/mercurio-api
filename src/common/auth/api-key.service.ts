import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { ApiKeyValidationResult } from '../types/tenant-context.type'
import { CacheService } from '../services/cache.service'
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
          lastUsedAt: apiKey.lastUsedAt,
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
}