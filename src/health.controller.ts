import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { PrismaService } from './prisma.service'
import { MercurioLogger } from './common/services/logger.service'

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTimeMs: number
  error?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  version: string
  timestamp: string
  uptime: number
  responseTimeMs: number
  checks: {
    database: HealthCheck
    memory: HealthCheck
    disk?: HealthCheck
  }
  metadata?: {
    nodeVersion: string
    environment: string
    pid: number
  }
}

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger
  ) {}

  @Get('/health')
  async health() {
    // Super simple health check for testing
    return {
      status: 'healthy',
      service: 'mercurio-api',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    }
  }

  /**
   * Check database connectivity and response time
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const isHealthy = await this.prisma.isHealthy()
      const responseTimeMs = Date.now() - startTime

      if (isHealthy) {
        return {
          name: 'database',
          status: responseTimeMs > 1000 ? 'degraded' : 'healthy',
          responseTimeMs,
        }
      } else {
        return {
          name: 'database',
          status: 'unhealthy',
          responseTimeMs,
          error: 'Database connectivity check failed',
        }
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      return {
        name: 'database',
        status: 'unhealthy',
        responseTimeMs,
        error: error instanceof Error ? error.message : 'Database check failed',
      }
    }
  }

  /**
   * Check memory usage and availability
   */
  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      const memoryUsage = process.memoryUsage()
      const responseTimeMs = Date.now() - startTime

      // Convert to MB for easier reading
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024)

      // Consider degraded if heap usage > 80% or RSS > 512MB
      const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      const isDegraded = heapUsagePercent > 80 || rssMB > 512
      const isUnhealthy = heapUsagePercent > 95 || rssMB > 1024 // 1GB RSS limit

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      if (isUnhealthy) {
        status = 'unhealthy'
      } else if (isDegraded) {
        status = 'degraded'
      }

      return {
        name: 'memory',
        status,
        responseTimeMs,
        error: isUnhealthy
          ? `High memory usage: ${heapUsedMB}MB/${heapTotalMB}MB heap, ${rssMB}MB RSS`
          : undefined,
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTimeMs,
        error: error instanceof Error ? error.message : 'Memory check failed',
      }
    }
  }

  /**
   * Determine overall system status based on individual checks
   */
  private determineOverallStatus(checks: {
    database: HealthCheck
    memory: HealthCheck
  }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map((check) => check.status)

    // If any check is unhealthy, overall is unhealthy
    if (statuses.some((status) => status === 'unhealthy')) {
      return 'unhealthy'
    }

    // If any check is degraded, overall is degraded
    if (statuses.some((status) => status === 'degraded')) {
      return 'degraded'
    }

    // All checks are healthy
    return 'healthy'
  }
}
