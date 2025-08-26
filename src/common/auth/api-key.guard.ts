import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiKeyService } from './api-key.service'
import { TENANT_CONTEXT_KEY } from '../context/tenant-context.provider'
import { TenantContext } from '../types/tenant-context.type'
import { MercurioLogger } from '../services/logger.service'
import { REQUEST_CONTEXT_KEY } from '../middleware/request-context.middleware'

export const REQUIRED_SCOPES_KEY = 'requiredScopes'

/**
 * Decorator to specify required scopes for an endpoint
 */
export const RequireScopes = Reflector.createDecorator<string[]>();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
    private readonly logger: MercurioLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const requestContext = request[REQUEST_CONTEXT_KEY]
    let apiKey: string | undefined

    // Create log context
    const logContext = {
      requestId: requestContext?.requestId,
      endpoint: request.url,
      method: request.method,
      ip: this.getClientIp(request)
    };

    // Extract API key from Authorization header (preferred method)
    const authHeader = request.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix
    }
    // Fallback: Check for API key in query parameter (for sendBeacon compatibility)
    else if (this.isEventsEndpoint(request) && request.query?.auth) {
      apiKey = request.query.auth as string
      // Log usage of query auth for monitoring (masked for security)
      this.logger.log('Using query parameter authentication for events endpoint', logContext, {
        category: 'auth_method',
        method: 'query_parameter',
        maskedApiKey: this.maskApiKey(apiKey)
      });
    }
    // Fallback: Check for API key in x-api-key header (alternative method)
    else if (request.headers['x-api-key']) {
      apiKey = request.headers['x-api-key'] as string
    }

    if (!apiKey) {
      this.logger.warn('Missing API key in request', logContext, {
        category: 'auth_failure',
        reason: 'missing_api_key'
      });
      
      throw new UnauthorizedException({
        error: {
          code: 'unauthorized',
          message: 'Missing API key. Provide via Authorization header (Bearer <key>), x-api-key header, or auth query parameter for events endpoints.',
        },
      })
    }

    // Validate API key
    const validationResult = await this.apiKeyService.validateKey(apiKey)
    if (!validationResult.isValid) {
      throw new UnauthorizedException({
        error: {
          code: 'unauthorized',
          message: 'Invalid or revoked API key',
        },
      })
    }

    // Create tenant context
    const tenantContext: TenantContext = {
      tenantId: validationResult.tenantId!,
      workspaceId: validationResult.workspaceId!,
      apiKeyId: validationResult.apiKeyId!,
      scopes: validationResult.scopes,
    }

    // Attach tenant context to request
    request[TENANT_CONTEXT_KEY] = tenantContext

    // Check required scopes
    const requiredScopes = this.reflector.get<string[]>(
      RequireScopes,
      context.getHandler(),
    )

    if (requiredScopes && requiredScopes.length > 0) {
      const hasRequiredScope = requiredScopes.some((scope) =>
        this.apiKeyService.hasScope(validationResult.scopes, scope),
      )

      if (!hasRequiredScope) {
        throw new ForbiddenException({
          error: {
            code: 'insufficient_scope',
            message: `API key requires one of the following scopes: ${requiredScopes.join(', ')}`,
            details: {
              requiredScopes,
              availableScopes: validationResult.scopes,
            },
          },
        })
      }
    }

    return true
  }

  /**
   * Check if the current request is targeting an events endpoint
   * Only events endpoints support query parameter authentication for sendBeacon compatibility
   */
  private isEventsEndpoint(request: any): boolean {
    const url = request.url || request.path || ''
    return url.includes('/v1/events/') || url.startsWith('/v1/events')
  }

  /**
   * Mask API key for secure logging
   * Shows only the prefix and last 6 characters: "ak_live_***_abc123"
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 10) {
      return '***'
    }
    
    // For standard API keys like "ak_live_1234567890abcdef"
    const parts = apiKey.split('_')
    if (parts.length >= 3) {
      const prefix = parts.slice(0, 2).join('_') // "ak_live"
      const suffix = apiKey.slice(-6) // last 6 chars
      return `${prefix}_***_${suffix}`
    }
    
    // Fallback for non-standard format
    const prefix = apiKey.substring(0, Math.min(6, apiKey.length))
    const suffix = apiKey.slice(-4)
    return `${prefix}***${suffix}`
  }

  /**
   * Extract client IP address for logging
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    )
  }
}