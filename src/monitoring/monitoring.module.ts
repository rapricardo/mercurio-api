import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}