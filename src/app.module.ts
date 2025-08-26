import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EventsModule } from './events/events.module';
import { CommonModule } from './common/common.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [CommonModule, EventsModule, MonitoringModule],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class AppModule {}

