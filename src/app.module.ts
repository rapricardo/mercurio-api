import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EventsModule } from './events/events.module';
import { CommonModule } from './common/common.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FunnelAnalyticsModule } from './analytics/funnels/funnel-analytics.module';
import { TenantsModule } from './tenants/tenants.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

@Module({
  imports: [
    CommonModule, 
    EventsModule, 
    MonitoringModule, 
    AnalyticsModule, 
    FunnelAnalyticsModule,
    TenantsModule,
    WorkspacesModule,
    OnboardingModule,
    ApiKeysModule,
  ],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class AppModule {}

