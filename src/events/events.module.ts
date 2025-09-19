import { Module } from '@nestjs/common'
import { EventsController } from './controllers/events.controller'
import { EventProcessorService } from './services/event-processor.service'
import { EnrichmentService } from './services/enrichment.service'
import { PrismaService } from '../prisma.service'
import { CommonModule } from '../common/common.module'
import { FunnelAnalyticsModule } from '../analytics/funnels/funnel-analytics.module'

@Module({
  imports: [CommonModule, FunnelAnalyticsModule],
  controllers: [EventsController],
  providers: [EventProcessorService, EnrichmentService, PrismaService],
  exports: [EventProcessorService, EnrichmentService],
})
export class EventsModule {}
