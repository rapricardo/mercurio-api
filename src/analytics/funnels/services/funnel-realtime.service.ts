import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { FunnelRepository } from '../repositories/funnel.repository'
import { FunnelCacheService } from './funnel-cache.service'
import { MercurioLogger } from '../../../common/services/logger.service'
import { MetricsService } from '../../../common/services/metrics.service'

interface EventData {
  tenant_id: string
  workspace_id: string
  anonymous_id: string
  lead_id?: string
  session_id: string
  event_name: string
  timestamp: Date
  page?: Record<string, any>
  utm?: Record<string, any>
  device?: Record<string, any>
  geo?: Record<string, any>
  props?: Record<string, any>
}

interface UserFunnelState {
  funnel_id: string
  funnel_version_id: string
  current_step: number
  completed_steps: number[]
  entry_time: Date
  last_activity_time: Date
  session_id: string
  conversion_status: 'in_progress' | 'converted' | 'abandoned'
}

interface FunnelStepMatch {
  step_order: number
  type: string
  label: string
  matching_rules: Array<{
    kind: string
    rules: Record<string, any>
  }>
}

/**
 * Real-time funnel event processing service
 * Processes events as they come in and updates funnel states
 */
@Injectable()
export class FunnelRealtimeService {
  private readonly logger = new Logger(FunnelRealtimeService.name)

  // Cache for active funnels to avoid DB queries
  private activeFunnelsCache = new Map<string, FunnelStepMatch[]>()
  private cacheLastUpdate = new Map<string, number>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly funnelRepository: FunnelRepository,
    private readonly cache: FunnelCacheService,
    private readonly mercurioLogger: MercurioLogger,
    private readonly metrics: MetricsService
  ) {}

  /**
   * Main entry point for processing events against funnels
   */
  async processEventForFunnels(event: EventData): Promise<void> {
    const startTime = Date.now()

    try {
      this.mercurioLogger.debug('Processing event for funnels', {
        eventName: event.event_name,
        anonymousId: event.anonymous_id,
        tenantId: event.tenant_id,
        workspaceId: event.workspace_id,
      })

      // 1. Get active funnels for this tenant/workspace
      const activeFunnels = await this.getActiveFunnels(event.tenant_id, event.workspace_id)

      if (activeFunnels.length === 0) {
        this.mercurioLogger.debug('No active funnels found for tenant/workspace', {
          tenantId: event.tenant_id,
          workspaceId: event.workspace_id,
        })
        return
      }

      // 2. Process event against each active funnel
      const processingPromises = activeFunnels.map((funnel) =>
        this.processEventForFunnel(event, funnel)
      )

      await Promise.all(processingPromises)

      // 3. Record metrics
      this.metrics.incrementCounter('funnel_events_processed', 1)

      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('funnel_event_processing_time', processingTime)
    } catch (error) {
      this.mercurioLogger.error(
        'Error processing event for funnels',
        error instanceof Error ? error : new Error(String(error))
      )

      this.metrics.incrementCounter('funnel_event_processing_errors', 1)

      // Don't throw - we don't want to break the event ingestion pipeline
    }
  }

  /**
   * Process a single event against a specific funnel
   */
  private async processEventForFunnel(
    event: EventData,
    funnel: { id: string; steps: FunnelStepMatch[] }
  ): Promise<void> {
    try {
      // 1. Get current user state for this funnel
      const userState = await this.getUserFunnelState(
        event.anonymous_id,
        funnel.id,
        event.tenant_id,
        event.workspace_id
      )

      // 2. Check if event matches any funnel step
      const matchedStep = this.findMatchingStep(event, funnel.steps)

      if (!matchedStep) {
        return // Event doesn't match any step in this funnel
      }

      // 3. Update user state based on matched step
      const updatedState = await this.updateUserFunnelState(
        userState,
        matchedStep,
        event,
        funnel.id
      )

      // 4. Store updated state
      await this.storeUserFunnelState(
        event.anonymous_id,
        funnel.id,
        event.tenant_id,
        event.workspace_id,
        updatedState
      )

      // 5. Update live metrics if this is a significant progression
      if (this.isSignificantProgression(userState, updatedState)) {
        await this.updateLiveMetrics(funnel.id, event.tenant_id, event.workspace_id, updatedState)
      }

      this.mercurioLogger.debug('Successfully processed event for funnel', {
        funnelId: funnel.id,
        anonymousId: event.anonymous_id,
        matchedStep: matchedStep.step_order,
        newState: updatedState.conversion_status,
      })
    } catch (error) {
      this.mercurioLogger.error(
        'Error processing event for specific funnel',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error // Re-throw to be handled by caller
    }
  }

  /**
   * Get active funnels for a tenant/workspace with caching
   */
  private async getActiveFunnels(
    tenantId: string,
    workspaceId: string
  ): Promise<Array<{ id: string; steps: FunnelStepMatch[] }>> {
    const cacheKey = `${tenantId}:${workspaceId}`
    const now = Date.now()

    // Check if we have cached data and it's still fresh
    if (
      this.activeFunnelsCache.has(cacheKey) &&
      this.cacheLastUpdate.has(cacheKey) &&
      now - this.cacheLastUpdate.get(cacheKey)! < this.CACHE_TTL
    ) {
      return [{ id: 'cached', steps: this.activeFunnelsCache.get(cacheKey)! }]
    }

    try {
      // Query active funnels from database
      const funnels = await this.prisma.funnel.findMany({
        where: {
          tenantId: BigInt(tenantId),
          workspaceId: BigInt(workspaceId),
          archivedAt: null,
          // Only get funnels with published versions
          versions: {
            some: {
              state: 'PUBLISHED',
            },
          },
        },
        include: {
          versions: {
            where: { state: 'PUBLISHED' },
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: {
                  orderIndex: 'asc',
                },
              },
            },
            orderBy: {
              version: 'desc',
            },
            take: 1, // Get latest published version
          },
        },
      })

      // Transform to the format we need
      const activeFunnels = funnels
        .filter((funnel) => funnel.versions.length > 0)
        .map((funnel) => {
          const latestVersion = funnel.versions[0]
          return {
            id: funnel.id.toString(),
            steps: latestVersion.steps.map((step) => ({
              step_order: step.orderIndex,
              type: step.type,
              label: step.label,
              matching_rules: step.matches.map((match) => ({
                kind: match.kind,
                rules: match.rules as Record<string, any>,
              })),
            })),
          }
        })

      // Update cache
      if (activeFunnels.length > 0) {
        // For now, cache the first funnel's steps (in a real implementation, you'd cache all)
        this.activeFunnelsCache.set(cacheKey, activeFunnels[0].steps)
        this.cacheLastUpdate.set(cacheKey, now)
      }

      return activeFunnels
    } catch (error) {
      this.mercurioLogger.error(
        'Error fetching active funnels',
        error instanceof Error ? error : new Error(String(error))
      )
      return []
    }
  }

  /**
   * Find which step (if any) matches the incoming event
   */
  private findMatchingStep(event: EventData, steps: FunnelStepMatch[]): FunnelStepMatch | null {
    for (const step of steps) {
      if (this.eventMatchesStep(event, step)) {
        return step
      }
    }
    return null
  }

  /**
   * Check if an event matches a funnel step's rules
   */
  private eventMatchesStep(event: EventData, step: FunnelStepMatch): boolean {
    for (const rule of step.matching_rules) {
      if (this.eventMatchesRule(event, rule)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if event matches a specific rule
   */
  private eventMatchesRule(
    event: EventData,
    rule: { kind: string; rules: Record<string, any> }
  ): boolean {
    switch (rule.kind) {
      case 'event_name':
        return event.event_name === rule.rules.event_name

      case 'page_url':
        return event.page?.url && this.matchesPattern(event.page.url, rule.rules.pattern)

      case 'page_title':
        return event.page?.title && this.matchesPattern(event.page.title, rule.rules.pattern)

      case 'utm_source':
        return event.utm?.source === rule.rules.source

      case 'custom_property':
        return event.props?.[rule.rules.property] === rule.rules.value

      default:
        this.mercurioLogger.warn('Unknown rule kind', { kind: rule.kind })
        return false
    }
  }

  /**
   * Simple pattern matching (supports exact match and wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
      return new RegExp(`^${regexPattern}$`, 'i').test(value)
    }
    return value.toLowerCase().includes(pattern.toLowerCase())
  }

  /**
   * Get current user state for a funnel (from cache/database)
   */
  private async getUserFunnelState(
    anonymousId: string,
    funnelId: string,
    tenantId: string,
    workspaceId: string
  ): Promise<UserFunnelState | null> {
    // Try cache first
    const cacheKey = `user_state:${tenantId}:${workspaceId}:${funnelId}:${anonymousId}`
    const cachedState = await this.cache.get<UserFunnelState>(cacheKey)

    if (cachedState) {
      return cachedState
    }

    // Query from database
    try {
      const dbState = await this.prisma.funnelUserState.findFirst({
        where: {
          tenantId: BigInt(tenantId),
          workspaceId: BigInt(workspaceId),
          funnelId: BigInt(funnelId),
          anonymousId,
        },
      })

      if (dbState) {
        const state: UserFunnelState = {
          funnel_id: dbState.funnelId.toString(),
          funnel_version_id: dbState.funnelVersionId.toString(),
          current_step: dbState.currentStepIndex || 0,
          completed_steps: [], // Will be computed from step progression
          entry_time: dbState.enteredAt,
          last_activity_time: dbState.lastActivityAt,
          session_id: '', // Not stored in current schema
          conversion_status: this.mapStatusToConversionStatus(dbState.status),
        }

        // Cache for future requests
        await this.cache.set(cacheKey, state, this.cache.getTTL('userState'))

        return state
      }

      return null // New user for this funnel
    } catch (error) {
      this.mercurioLogger.error(
        'Error fetching user funnel state',
        error instanceof Error ? error : new Error(String(error))
      )
      return null
    }
  }

  /**
   * Update user funnel state based on matched step
   */
  private async updateUserFunnelState(
    currentState: UserFunnelState | null,
    matchedStep: FunnelStepMatch,
    event: EventData,
    funnelId: string
  ): Promise<UserFunnelState> {
    const now = event.timestamp

    if (!currentState) {
      // New user entering the funnel
      return {
        funnel_id: funnelId,
        funnel_version_id: '1', // TODO: Get actual version ID
        current_step: matchedStep.step_order,
        completed_steps: [matchedStep.step_order],
        entry_time: now,
        last_activity_time: now,
        session_id: event.session_id,
        conversion_status: 'in_progress',
      }
    }

    // Existing user progressing through funnel
    const updatedState = { ...currentState }
    updatedState.last_activity_time = now

    // Check if this is forward progression
    if (matchedStep.step_order > currentState.current_step) {
      updatedState.current_step = matchedStep.step_order
      updatedState.completed_steps = [
        ...currentState.completed_steps.filter((step) => step !== matchedStep.step_order),
        matchedStep.step_order,
      ].sort((a, b) => a - b)
    } else if (!currentState.completed_steps.includes(matchedStep.step_order)) {
      // User completed a step they hadn't completed before
      updatedState.completed_steps = [...currentState.completed_steps, matchedStep.step_order].sort(
        (a, b) => a - b
      )
    }

    // Check if user has completed the funnel
    // TODO: This logic should be more sophisticated, checking against actual funnel definition
    if (matchedStep.type === 'conversion') {
      updatedState.conversion_status = 'converted'
    }

    return updatedState
  }

  /**
   * Store updated user state
   */
  private async storeUserFunnelState(
    anonymousId: string,
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    state: UserFunnelState
  ): Promise<void> {
    try {
      // Store in database
      await this.prisma.funnelUserState.upsert({
        where: {
          unique_user_funnel_state: {
            tenantId: BigInt(tenantId),
            workspaceId: BigInt(workspaceId),
            funnelId: BigInt(funnelId),
            anonymousId,
          },
        },
        update: {
          currentStepIndex: state.current_step,
          lastActivityAt: state.last_activity_time,
          status: this.mapConversionStatusToStatus(state.conversion_status),
          ...(state.conversion_status === 'converted' && { completedAt: state.last_activity_time }),
          ...(state.conversion_status === 'abandoned' && { exitedAt: state.last_activity_time }),
        },
        create: {
          tenantId: BigInt(tenantId),
          workspaceId: BigInt(workspaceId),
          funnelId: BigInt(funnelId),
          funnelVersionId: BigInt(state.funnel_version_id),
          anonymousId,
          currentStepIndex: state.current_step,
          enteredAt: state.entry_time,
          lastActivityAt: state.last_activity_time,
          status: this.mapConversionStatusToStatus(state.conversion_status),
          ...(state.conversion_status === 'converted' && { completedAt: state.last_activity_time }),
          ...(state.conversion_status === 'abandoned' && { exitedAt: state.last_activity_time }),
        },
      })

      // Update cache
      const cacheKey = `user_state:${tenantId}:${workspaceId}:${funnelId}:${anonymousId}`
      await this.cache.set(cacheKey, state, this.cache.getTTL('userState'))
    } catch (error) {
      this.mercurioLogger.error(
        'Error storing user funnel state',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  /**
   * Check if state change represents significant progression
   */
  private isSignificantProgression(
    oldState: UserFunnelState | null,
    newState: UserFunnelState
  ): boolean {
    if (!oldState) {
      return true // New user entering funnel
    }

    return (
      newState.current_step > oldState.current_step ||
      newState.conversion_status !== oldState.conversion_status ||
      newState.completed_steps.length > oldState.completed_steps.length
    )
  }

  /**
   * Update live metrics when significant progression occurs
   */
  private async updateLiveMetrics(
    funnelId: string,
    tenantId: string,
    workspaceId: string,
    state: UserFunnelState
  ): Promise<void> {
    try {
      // Update real-time counters
      this.metrics.incrementCounter('funnel_user_progression', 1)

      // Invalidate live metrics cache to force refresh
      const liveMetricsCacheKey = this.cache.generateCacheKey('live', {
        funnelId,
        tenantId,
        workspaceId,
      })

      await this.cache.set(liveMetricsCacheKey, null, 0) // Immediate expiry
    } catch (error) {
      this.mercurioLogger.error(
        'Error updating live metrics',
        error instanceof Error ? error : new Error(String(error))
      )
      // Don't throw - this is not critical for event processing
    }
  }

  /**
   * Health check for the real-time service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string }> {
    try {
      // Check database connectivity
      await this.prisma.$queryRaw`SELECT 1`

      // Check cache connectivity
      const testKey = 'health_check_test'
      await this.cache.set(testKey, 'test', 1000)
      const testValue = await this.cache.get(testKey)

      if (testValue !== 'test') {
        return {
          status: 'unhealthy',
          details: 'Cache connectivity issue',
        }
      }

      return {
        status: 'healthy',
        details: 'All systems operational',
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Map database status to conversion status
   */
  private mapStatusToConversionStatus(status: string): 'in_progress' | 'converted' | 'abandoned' {
    switch (status) {
      case 'active':
        return 'in_progress'
      case 'completed':
        return 'converted'
      case 'exited':
      case 'abandoned':
        return 'abandoned'
      default:
        return 'in_progress'
    }
  }

  /**
   * Map conversion status to database status
   */
  private mapConversionStatusToStatus(
    conversionStatus: 'in_progress' | 'converted' | 'abandoned'
  ): string {
    switch (conversionStatus) {
      case 'in_progress':
        return 'active'
      case 'converted':
        return 'completed'
      case 'abandoned':
        return 'abandoned'
      default:
        return 'active'
    }
  }
}
