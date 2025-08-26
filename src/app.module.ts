import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EventsModule } from './events/events.module';
import { CommonModule } from './common/common.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FunnelAnalyticsModule } from './analytics/funnels/funnel-analytics.module';

@Module({
  imports: [CommonModule, EventsModule, MonitoringModule, AnalyticsModule, FunnelAnalyticsModule],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class AppModule {}

