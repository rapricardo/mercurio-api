import { Module } from '@nestjs/common'
import { CommonModule } from '../../common/common.module'
import { AnalyticsModule } from '../analytics.module'

// Controllers
import { FunnelConfigController } from './controllers/funnel-config.controller'
import { FunnelAnalyticsController } from './controllers/funnel-analytics.controller'

// Services
import { FunnelConfigService } from './services/funnel-config.service'
import { FunnelAnalyticsService } from './services/funnel-analytics.service'
import { FunnelCacheService } from './services/funnel-cache.service'
import { FunnelRealtimeService } from './services/funnel-realtime.service'
import { FunnelPathAnalysisService } from './services/funnel-path-analysis.service'
import { FunnelAttributionService } from './services/funnel-attribution.service'
import { FunnelComparisonService } from './services/funnel-comparison.service'
import { FunnelExportService } from './services/funnel-export.service'
import { BottleneckDetectionService } from './services/bottleneck-detection.service'

// Repositories
import { FunnelRepository } from './repositories/funnel.repository'
import { FunnelAnalyticsRepository } from './repositories/funnel-analytics.repository'

/**
 * FunnelAnalyticsModule provides comprehensive funnel analysis capabilities
 *
 * Phase 1 Features (Foundation) - COMPLETED:
 * - Funnel configuration CRUD operations
 * - Multi-tenant data isolation
 * - Intelligent caching with TTL strategies
 * - Performance-optimized database queries
 * - Comprehensive error handling and logging
 *
 * Phase 2 Features (Core Analytics Engine) - IN PROGRESS:
 * - Conversion rate calculation engine (Task 2.1 - COMPLETED)
 * - Drop-off analysis & bottleneck detection (Task 2.2 - TODO)
 * - Cohort analysis system (Task 2.3 - TODO)
 * - Time-to-conversion analytics (Task 2.4 - TODO)
 *
 * Architecture:
 * - Follows established NestJS patterns from AnalyticsModule
 * - Integrates with existing CommonModule infrastructure
 * - Uses Prisma ORM with performance optimizations
 * - Implements multi-layer caching (memory/Redis/materialized views)
 * - Provides complete TypeScript type coverage
 * - Statistical analysis with confidence intervals and significance testing
 */
@Module({
  imports: [
    CommonModule, // Provides PrismaService, MetricsService, CacheService, Logger
    AnalyticsModule, // Provides shared analytics infrastructure
  ],
  controllers: [
    FunnelConfigController, // Phase 1: Configuration management
    FunnelAnalyticsController, // Phase 2: Analytics endpoints
  ],
  providers: [
    // Core services
    FunnelConfigService,
    FunnelAnalyticsService, // Phase 2: Analytics business logic
    FunnelCacheService,
    FunnelRealtimeService, // Phase 3: Real-time processing
    FunnelPathAnalysisService, // Phase 3: Multi-path analysis
    FunnelAttributionService, // Phase 4: Attribution analysis
    FunnelComparisonService, // Phase 4: A/B testing & comparison
    FunnelExportService, // Phase 4: Export & integration
    BottleneckDetectionService, // Phase 3: Advanced bottleneck detection

    // Data layer
    FunnelRepository,
    FunnelAnalyticsRepository, // Phase 2: Advanced analytics queries
  ],
  exports: [
    // Export services for use by other modules or future funnel features
    FunnelConfigService,
    FunnelAnalyticsService, // Export for future phases
    FunnelCacheService,
    FunnelRealtimeService, // Export for events integration
    FunnelPathAnalysisService, // Export for path analysis
    FunnelAttributionService, // Export for attribution analysis
    FunnelComparisonService, // Export for A/B testing & comparison
    FunnelExportService, // Export for data export & integration
    BottleneckDetectionService, // Export for advanced detection
    FunnelRepository,
    FunnelAnalyticsRepository, // Export for future phases
  ],
})
export class FunnelAnalyticsModule {
  constructor() {
    // Module initialization complete
    console.log('🔄 FunnelAnalyticsModule initialized - Phase 2 Core Analytics Engine in progress')
  }
}
