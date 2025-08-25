import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MetricsService } from './common/services/metrics.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private metrics?: MetricsService;

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Database connection pool configuration
      __internal: {
        engine: {
          connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
          poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '10000'), // 10s
          idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000'), // 10min
        },
      },
    });

    // Log database queries in development and record metrics
    this.$on('query', (event: any) => {
      // Record database metrics
      this.metrics?.incrementCounter('database.queries');
      this.metrics?.recordLatency('database.query_latency', event.duration || 0);
      
      // Log in development
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Query: ${event.query}`);
        this.logger.debug(`Params: ${event.params}`);
        this.logger.debug(`Duration: ${event.duration}ms`);
      }
      
      // Log slow queries (> 100ms) in all environments
      if (event.duration && event.duration > 100) {
        this.logger.warn(`Slow database query detected`, {
          query: event.query,
          duration: event.duration,
          params: event.params,
        });
      }
    });

    this.$on('error', (event: any) => {
      this.logger.error('Database error:', event);
    });

    this.$on('warn', (event: any) => {
      this.logger.warn('Database warning:', event);
    });

    this.$on('info', (event: any) => {
      this.logger.log('Database info:', event);
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
    
    // Record initial connection count
    this.updateConnectionCount();
  }
  
  /**
   * Set metrics service for database monitoring
   */
  setMetrics(metrics: MetricsService): void {
    this.metrics = metrics;
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Helper method to handle database operations with error logging
   */
  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`Database operation failed in ${context}:`, error);
      throw error;
    }
  }

  /**
   * Health check method
   */
  async isHealthy(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.$queryRaw`SELECT 1`;
      const duration = Date.now() - startTime;
      
      // Record health check latency
      this.metrics?.recordLatency('database.health_check_latency', duration);
      
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }
  
  /**
   * Update connection count metric
   */
  private updateConnectionCount(): void {
    // For Prisma, we'll track the configured connection limit
    const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || '10');
    this.metrics?.recordGauge('database.connections', connectionLimit);
  }
}