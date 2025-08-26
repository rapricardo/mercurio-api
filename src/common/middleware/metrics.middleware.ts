import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { MetricsService } from '../services/metrics.service';
import { MercurioLogger } from '../services/logger.service';
import { REQUEST_CONTEXT_KEY } from './request-context.middleware';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: MercurioLogger,
  ) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const startTime = Date.now();
    const requestContext = (req as any)[REQUEST_CONTEXT_KEY];

    // Increment request counter
    this.metrics.incrementCounter('requests.total');

    // Listen for response finish to calculate latency and status
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const success = statusCode < 400;

      // Record request latency
      this.metrics.recordLatency('requests.latency', duration);

      // Record success/error counters
      if (success) {
        this.metrics.incrementCounter('requests.success');
      } else {
        this.metrics.incrementCounter('requests.errors');
      }

      // Log slow requests (> 1 second) for monitoring
      if (duration > 1000) {
        this.logger.warn('Slow request detected', {
          requestId: requestContext?.requestId,
        }, {
          category: 'performance',
          method: req.method,
          url: req.url,
          statusCode,
          duration,
          threshold: 1000,
        });
      }

      // Log p50 latency violations (> 50ms requirement)
      if (duration > 50) {
        this.logger.debug('Request exceeded p50 latency requirement', {
          requestId: requestContext?.requestId,
        }, {
          category: 'performance',
          method: req.method,
          url: req.url,
          duration,
          requirement: 50,
        });
      }
    });

    next();
  }
}