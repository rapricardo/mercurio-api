import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { MetricsService } from './services/metrics.service';
import { TimeSeriesService } from './services/time-series.service';
import { AnalyticsCacheService } from './services/analytics-cache.service';

@Module({
  imports: [CommonModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsRepository,
    MetricsService,
    TimeSeriesService,
    AnalyticsCacheService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsRepository,
    MetricsService,
    TimeSeriesService,
    AnalyticsCacheService,
  ],
})
export class AnalyticsModule {}