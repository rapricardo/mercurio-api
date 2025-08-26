import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { AnalyticsModule } from '../analytics.module';

// Controllers
import { FunnelConfigController } from './controllers/funnel-config.controller';

// Services  
import { FunnelConfigService } from './services/funnel-config.service';
import { FunnelCacheService } from './services/funnel-cache.service';

// Repositories
import { FunnelRepository } from './repositories/funnel.repository';

/**
 * FunnelAnalyticsModule provides comprehensive funnel analysis capabilities
 * 
 * Phase 1 Features (Foundation):
 * - Funnel configuration CRUD operations
 * - Multi-tenant data isolation
 * - Intelligent caching with TTL strategies
 * - Performance-optimized database queries
 * - Comprehensive error handling and logging
 * 
 * Architecture:
 * - Follows established NestJS patterns from AnalyticsModule
 * - Integrates with existing CommonModule infrastructure
 * - Uses Prisma ORM with performance optimizations
 * - Implements multi-layer caching (memory/Redis/materialized views)
 * - Provides complete TypeScript type coverage
 */
@Module({
  imports: [
    CommonModule,     // Provides PrismaService, MetricsService, CacheService, Logger
    AnalyticsModule,  // Provides shared analytics infrastructure
  ],
  controllers: [
    FunnelConfigController,
  ],
  providers: [
    // Core services
    FunnelConfigService,
    FunnelCacheService,
    
    // Data layer
    FunnelRepository,
  ],
  exports: [
    // Export services for use by other modules or future funnel features
    FunnelConfigService,
    FunnelCacheService,
    FunnelRepository,
  ],
})
export class FunnelAnalyticsModule {
  constructor() {
    // Module initialization complete
    console.log('🔄 FunnelAnalyticsModule initialized - Phase 1 Foundation Ready');
  }
}