import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { MercurioLogger } from '../services/logger.service';
import { MetricsService } from '../services/metrics.service';

export const REQUEST_CONTEXT_KEY = 'requestContext';

export interface RequestContext {
  requestId: string;
  startTime: number;
  tenantId?: string;
  workspaceId?: string;
  apiKeyId?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
  ) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    // Generate or extract request ID (short base36 format, not UUID)
    const requestId = (req.headers['x-request-id'] as string) || this.generateRequestId();
    
    // Create request context
    const requestContext: RequestContext = {
      requestId,
      startTime: Date.now()
    };

    // Store in request object
    (req as any)[REQUEST_CONTEXT_KEY] = requestContext;

    // Set response header for client tracking
    res.setHeader('X-Request-ID', requestId);

    // Increment request counter
    this.metrics.incrementCounter('requests.total');

    // Log request start using structured logger
    this.logger.log('Request started', 
      { requestId },
      { 
        category: 'http_request',
        phase: 'start',
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: this.getClientIp(req)
      }
    );

    // Log request completion and record metrics
    res.on('finish', () => {
      const duration = Date.now() - requestContext.startTime;
      const success = res.statusCode < 400;

      // Record metrics
      this.metrics.recordLatency('requests.latency', duration);
      if (success) {
        this.metrics.incrementCounter('requests.success');
      } else {
        this.metrics.incrementCounter('requests.errors');
      }

      // Log slow requests for monitoring
      if (duration > 1000) {
        this.logger.warn('Slow request detected', { requestId }, {
          category: 'performance',
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          threshold: 1000,
        });
      }

      // Log p50 latency violations (> 50ms requirement)
      if (duration > 50) {
        this.metrics.incrementCounter('performance.p50_violations');
        this.logger.debug('Request exceeded p50 latency requirement', { requestId }, {
          category: 'performance',
          method: req.method,
          url: req.url,
          duration,
          requirement: 50,
        });
      }
      
      this.logger.log('Request completed',
        {
          requestId,
          tenantId: requestContext.tenantId,
          workspaceId: requestContext.workspaceId,
          apiKeyId: requestContext.apiKeyId
        },
        {
          category: 'http_request',
          phase: 'end',
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          statusClass: `${Math.floor(res.statusCode / 100)}xx`,
          duration,
          contentLength: res.getHeader('content-length') || 0,
          success
        }
      );
    });

    next();
  }

  /**
   * Generate short, readable request ID (base36, 64-bit entropy)
   * Format: 8 characters base36 (e.g., "a7b2c3d4")
   */
  private generateRequestId(): string {
    return randomBytes(4).toString('hex').toLowerCase();
  }

  /**
   * Extract client IP address with proper proxy handling
   */
  private getClientIp(req: FastifyRequest['raw']): string {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip']?.toString() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}