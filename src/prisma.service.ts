import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MetricsService } from './common/services/metrics.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private metrics?: MetricsService;

  constructor() {
    // Configure Prisma logs based on environment
    const enableSqlLogging = process.env.SQL_LOGGING === 'true' || process.env.NODE_ENV === 'development';
    const prismaLog: Array<{ level: 'query' | 'error' | 'info' | 'warn'; emit: 'event' }> = [];
    if (enableSqlLogging) {
      prismaLog.push({ level: 'query', emit: 'event' });
      prismaLog.push({ level: 'info', emit: 'event' });
    }
    prismaLog.push({ level: 'error', emit: 'event' });
    prismaLog.push({ level: 'warn', emit: 'event' });

    super({
      log: prismaLog,
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Configure for pgBouncer compatibility
      ...(process.env.DATABASE_URL?.includes('pgbouncer=true') && {
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      }),
    });

    // Event handlers will be set up after connection
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

  /**
   * Reset database connection to fix prepared statement conflicts
   */
  async resetConnection(): Promise<void> {
    try {
      this.logger.warn('Resetting database connection due to prepared statement conflict...');
      await this.$disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.$connect();
      this.logger.log('Database connection reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset database connection:', error);
      throw error;
    }
  }
}
