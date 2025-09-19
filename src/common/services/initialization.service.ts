import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { MetricsService } from './metrics.service'

@Injectable()
export class InitializationService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService
  ) {}

  async onModuleInit() {
    // Initialize metrics integration with PrismaService
    this.prisma.setMetrics(this.metrics)
  }
}
