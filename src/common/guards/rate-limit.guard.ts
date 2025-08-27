import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitService } from '../services/rate-limit.service';
import { MercurioLogger } from '../services/logger.service';
import { REQUEST_CONTEXT_KEY } from '../middleware/request-context.middleware';

// Decorator to set rate limit endpoint type  
const RateLimitEndpointDecorator = Reflector.createDecorator<'events' | 'queries' | 'admin'>();

export const RateLimitEndpoint = (endpoint: 'events' | 'queries' | 'admin') => {
  return RateLimitEndpointDecorator(endpoint);
};

// Custom rate limit decorator
export const RateLimit = Reflector.createDecorator<{
  endpoint: 'events' | 'queries' | 'admin';
  tier?: string;
}>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly mercurioLogger: MercurioLogger,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit configuration from decorator
    const rateLimitConfig = this.reflector.get(RateLimit, context.getHandler());
    
    if (!rateLimitConfig) {
      // No rate limit configured for this endpoint
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    
    // Get tenant/req context
    const requestContext = ((request.raw as any)[REQUEST_CONTEXT_KEY] ||= {});
    const tenantContext: any = (request as any).tenantContext;
    const tenantId = tenantContext?.tenantId?.toString() || requestContext.tenantId;

    if (!tenantId) {
      this.logger.warn('Rate limit check skipped - no tenant context available');
      return true;
    }

    // Backfill tenant info into request context for consistent logging
    requestContext.tenantId = tenantId;
    const endpoint = rateLimitConfig.endpoint;
    const tier = rateLimitConfig.tier || this.getTenantTier(tenantId); // Default tier resolution

    try {
      const result = await this.rateLimitService.checkLimit(tenantId, endpoint, tier);

      // Set rate limit headers
      response.header('X-RateLimit-Limit', result.limit.toString());
      response.header('X-RateLimit-Remaining', result.remaining.toString());
      response.header('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString());

      if (!result.allowed) {
        // Add retry-after header
        if (result.retryAfter) {
          response.header('Retry-After', result.retryAfter.toString());
        }

        // Log rate limit violation
        this.mercurioLogger.warn('Rate limit exceeded', {
          requestId: requestContext.requestId,
          tenantId,
        }, {
          category: 'rate_limit',
          endpoint,
          tier,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime.toISOString(),
          retryAfter: result.retryAfter,
          userAgent: request.headers['user-agent'],
          ip: this.getClientIp(request),
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            details: {
              limit: result.limit,
              remaining: result.remaining,
              resetTime: result.resetTime.toISOString(),
              retryAfter: result.retryAfter,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment usage counter
      await this.rateLimitService.incrementUsage(tenantId, endpoint, tier);

      // Log successful rate limit check (debug level)
      this.mercurioLogger.debug('Rate limit check passed', {
        requestId: requestContext.requestId,
        tenantId,
      }, {
        category: 'rate_limit',
        endpoint,
        tier,
        limit: result.limit,
        remaining: result.remaining,
      });

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error; // Re-throw rate limit exceptions
      }

      // Log rate limit service errors but allow request to proceed
      this.logger.error('Rate limit check failed, allowing request', error, {
        tenantId,
        endpoint,
        tier,
      });

      return true;
    }
  }

  /**
   * Get tenant tier (placeholder implementation)
   * In a real implementation, this would query the database or cache
   */
  private getTenantTier(tenantId: string): string {
    // TODO: Implement proper tier resolution from database/cache
    // For now, default to 'free' tier
    return 'free';
  }

  /**
   * Extract client IP address with proper proxy handling
   */
  private getClientIp(request: FastifyRequest): string {
    return (
      request.headers['x-forwarded-for']?.toString().split(',')[0] ||
      request.headers['x-real-ip']?.toString() ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
