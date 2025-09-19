import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { HybridAuthGuard } from '../../common/auth/hybrid-auth.guard'
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard'
import { CurrentTenant } from '../../common/context/tenant-context.provider'
import { HybridTenantContext } from '../../common/types/tenant-context.type'
import { ApiKeyService } from '../../common/auth/api-key.service'
import { TrackEventDto, BatchEventDto, IdentifyEventDto } from '../dto/track-event.dto'
import { EventResponse, BatchResponse, IdentifyResponse } from '../dto/response.dto'
import { EventProcessorService } from '../services/event-processor.service'
import { EnrichmentService } from '../services/enrichment.service'
import { MercurioLogger } from '../../common/services/logger.service'
import { REQUEST_CONTEXT_KEY } from '../../common/middleware/request-context.middleware'
import { FunnelRealtimeService } from '../../analytics/funnels/services/funnel-realtime.service'

@Controller('v1/events')
@UseGuards(HybridAuthGuard, RateLimitGuard)
export class EventsController {
  private readonly MAX_BATCH_SIZE = 50 // Sprint 1: Reduced from 1000
  private readonly MAX_PAYLOAD_SIZE = 256 * 1024 // Sprint 1: 256KB (reduced from 1MB)

  constructor(
    private readonly eventProcessor: EventProcessorService,
    private readonly enrichment: EnrichmentService,
    private readonly logger: MercurioLogger,
    private readonly apiKeyService: ApiKeyService,
    private readonly funnelRealtime: FunnelRealtimeService
  ) {}

  @Post('track')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ endpoint: 'events' })
  async trackEvent(
    @Body() trackEvent: TrackEventDto,
    @CurrentTenant() tenant: HybridTenantContext,
    @Req() request: FastifyRequest
  ): Promise<EventResponse> {
    // Validate write permissions
    if (!this.apiKeyService.canWriteEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Write permission required for event tracking',
        },
      })
    }
    const requestContext = request[REQUEST_CONTEXT_KEY]
    // Validate payload size
    const payloadSize = JSON.stringify(trackEvent).length
    if (payloadSize > this.MAX_PAYLOAD_SIZE) {
      throw new PayloadTooLargeException({
        error: {
          code: 'payload_too_large',
          message: `Request payload exceeds maximum size of ${this.MAX_PAYLOAD_SIZE} bytes`,
          details: {
            payloadSize,
            maxSize: this.MAX_PAYLOAD_SIZE,
          },
        },
      })
    }

    // Validate timestamp
    const timestampValidation = this.enrichment.validateTimestamp(trackEvent.timestamp)
    if (!timestampValidation.isValid) {
      throw new BadRequestException({
        error: {
          code: 'invalid_timestamp',
          message: timestampValidation.error,
          details: {
            timestamp: trackEvent.timestamp,
          },
        },
      })
    }

    // Enrich event with server-side metadata
    const enrichmentData = this.enrichment.enrichEvent(request)

    // Process the event
    const result = await this.eventProcessor.processTrackEvent(trackEvent, tenant, enrichmentData)

    if (!result.success) {
      // Log processing failure
      this.logger.error(
        'Track event processing failed',
        undefined,
        {
          requestId: requestContext?.requestId,
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
        },
        {
          category: 'api_endpoint',
          endpoint: 'track',
          eventName: trackEvent.event_name,
          errors: result.errors,
        }
      )

      throw new BadRequestException({
        error: {
          code: 'processing_failed',
          message: 'Failed to process event',
          details: {
            errors: result.errors,
          },
        },
      })
    }

    // Process event for funnels (async, non-blocking)
    this.processEventForFunnels(trackEvent, tenant, enrichmentData, result.eventId || '').catch(
      (error) => {
        this.logger.warn('Funnel processing failed for event', error, {
          requestId: requestContext?.requestId,
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          eventId: result.eventId,
        })
      }
    )

    // Log successful processing
    this.logger.log(
      'Track event processed successfully',
      {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        eventId: result.eventId,
      },
      {
        category: 'api_endpoint',
        endpoint: 'track',
        eventName: trackEvent.event_name,
        isDuplicate: result.isDuplicate,
        payloadSize,
      }
    )

    return {
      accepted: true,
      event_id: result.eventId,
      is_duplicate: result.isDuplicate,
    }
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ endpoint: 'events' })
  async batchEvents(
    @Body() batchDto: BatchEventDto,
    @CurrentTenant() tenant: HybridTenantContext,
    @Req() request: FastifyRequest
  ): Promise<BatchResponse> {
    // Validate write permissions
    if (!this.apiKeyService.canWriteEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Write permission required for batch events',
        },
      })
    }
    const { events } = batchDto
    const requestContext = request[REQUEST_CONTEXT_KEY]

    // Validate batch size
    if (events.length > this.MAX_BATCH_SIZE) {
      throw new BadRequestException({
        error: {
          code: 'batch_too_large',
          message: `Batch contains ${events.length} events, maximum allowed is ${this.MAX_BATCH_SIZE}`,
          details: {
            batchSize: events.length,
            maxBatchSize: this.MAX_BATCH_SIZE,
          },
        },
      })
    }

    // Validate payload size
    const payloadSize = JSON.stringify(batchDto).length
    if (payloadSize > this.MAX_PAYLOAD_SIZE) {
      throw new PayloadTooLargeException({
        error: {
          code: 'payload_too_large',
          message: `Request payload exceeds maximum size of ${this.MAX_PAYLOAD_SIZE} bytes`,
          details: {
            payloadSize,
            maxSize: this.MAX_PAYLOAD_SIZE,
          },
        },
      })
    }

    // Validate all timestamps
    const timestampErrors: string[] = []
    events.forEach((event, index) => {
      const validation = this.enrichment.validateTimestamp(event.timestamp)
      if (!validation.isValid) {
        timestampErrors.push(`Event ${index}: ${validation.error}`)
      }
    })

    if (timestampErrors.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'invalid_timestamps',
          message: 'One or more events have invalid timestamps',
          details: {
            errors: timestampErrors,
          },
        },
      })
    }

    // Enrich all events
    const enrichmentData = events.map(() => this.enrichment.enrichEvent(request))

    // Process batch
    const batchResult = await this.eventProcessor.processBatchEvents(events, tenant, enrichmentData)

    // Process successful events for funnels (async, non-blocking)
    this.processBatchEventsForFunnels(events, tenant, enrichmentData, batchResult.results).catch(
      (error) => {
        this.logger.warn('Batch funnel processing failed', error, {
          requestId: requestContext?.requestId,
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          batchSize: events.length,
        })
      }
    )

    // Transform results to response format
    const results: EventResponse[] = batchResult.results.map((result) => ({
      accepted: result.success,
      event_id: result.eventId,
      is_duplicate: result.isDuplicate,
      errors: result.errors,
    }))

    // Log batch processing results
    this.logger.log(
      'Batch events processed',
      {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      },
      {
        category: 'api_endpoint',
        endpoint: 'batch',
        totalEvents: batchResult.totalProcessed,
        successful: batchResult.successCount,
        failed: batchResult.errorCount,
        payloadSize: JSON.stringify(batchDto).length,
        duplicates: results.filter((r) => r.is_duplicate).length,
      }
    )

    return {
      accepted: batchResult.successCount,
      rejected: batchResult.errorCount,
      total: batchResult.totalProcessed,
      results,
    }
  }

  @Post('identify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ endpoint: 'events' })
  async identifyUser(
    @Body() identifyDto: IdentifyEventDto,
    @CurrentTenant() tenant: HybridTenantContext,
    @Req() request: FastifyRequest
  ): Promise<IdentifyResponse> {
    // Validate write permissions
    if (!this.apiKeyService.canWriteEvents(tenant.scopes)) {
      throw new BadRequestException({
        error: {
          code: 'insufficient_permissions',
          message: 'Write permission required for user identification',
        },
      })
    }
    const requestContext = request[REQUEST_CONTEXT_KEY]
    // Validate payload size
    const payloadSize = JSON.stringify(identifyDto).length
    if (payloadSize > this.MAX_PAYLOAD_SIZE) {
      throw new PayloadTooLargeException({
        error: {
          code: 'payload_too_large',
          message: `Request payload exceeds maximum size of ${this.MAX_PAYLOAD_SIZE} bytes`,
          details: {
            payloadSize,
            maxSize: this.MAX_PAYLOAD_SIZE,
          },
        },
      })
    }

    // Validate timestamp if provided
    if (identifyDto.timestamp) {
      const timestampValidation = this.enrichment.validateTimestamp(identifyDto.timestamp)
      if (!timestampValidation.isValid) {
        throw new BadRequestException({
          error: {
            code: 'invalid_timestamp',
            message: timestampValidation.error,
            details: {
              timestamp: identifyDto.timestamp,
            },
          },
        })
      }
    }

    // Ensure either user_id or traits are provided
    if (!identifyDto.user_id && !identifyDto.traits) {
      throw new BadRequestException({
        error: {
          code: 'missing_identification',
          message: 'Either user_id or traits must be provided for identification',
        },
      })
    }

    // Validate email format if provided in traits
    if (identifyDto.traits?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(identifyDto.traits.email)) {
        throw new BadRequestException({
          error: {
            code: 'invalid_email',
            message: 'Invalid email format in traits',
            details: {
              email: identifyDto.traits.email,
            },
          },
        })
      }
    }

    // Enrich event with server-side metadata
    const enrichmentData = this.enrichment.enrichEvent(request)

    // Process identification
    const result = await this.eventProcessor.processIdentifyEvent(
      identifyDto,
      tenant,
      enrichmentData
    )

    if (!result.success) {
      // Log identification failure
      this.logger.error(
        'Identity event processing failed',
        undefined,
        {
          requestId: requestContext?.requestId,
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
        },
        {
          category: 'api_endpoint',
          endpoint: 'identify',
          anonymousId: identifyDto.anonymous_id,
          errors: result.errors,
        }
      )

      throw new BadRequestException({
        error: {
          code: 'processing_failed',
          message: 'Failed to process identification',
          details: {
            errors: result.errors,
          },
        },
      })
    }

    // Log successful identification
    this.logger.log(
      'Identity event processed successfully',
      {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        leadId: result.leadId,
      },
      {
        category: 'api_endpoint',
        endpoint: 'identify',
        anonymousId: identifyDto.anonymous_id,
        hasEmail: !!identifyDto.traits?.email,
        hasUserId: !!identifyDto.user_id,
        payloadSize,
      }
    )

    return {
      accepted: true,
      lead_id: result.leadId,
    }
  }

  /**
   * Process event for funnel analysis (async, non-blocking)
   */
  private async processEventForFunnels(
    trackEvent: TrackEventDto,
    tenant: HybridTenantContext,
    enrichmentData: any,
    eventId: string
  ): Promise<void> {
    try {
      // Transform to the format expected by FunnelRealtimeService
      const eventData = {
        tenant_id: tenant.tenantId.toString(),
        workspace_id: tenant.workspaceId.toString(),
        anonymous_id: trackEvent.anonymous_id,
        lead_id: undefined, // Will be populated if user is identified
        session_id: trackEvent.session_id || '',
        event_name: trackEvent.event_name,
        timestamp: new Date(trackEvent.timestamp),
        page: trackEvent.page,
        utm: trackEvent.utm,
        device: enrichmentData.device,
        geo: enrichmentData.geo,
        props: trackEvent.properties,
      }

      // Process event against funnels
      await this.funnelRealtime.processEventForFunnels(eventData)
    } catch (error) {
      // Don't throw - this is background processing
      this.logger.error(
        'Background funnel processing error',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          eventId,
          eventName: trackEvent.event_name,
        }
      )
    }
  }

  /**
   * Process batch events for funnel analysis (async, non-blocking)
   */
  private async processBatchEventsForFunnels(
    events: TrackEventDto[],
    tenant: HybridTenantContext,
    enrichmentData: any[],
    results: any[]
  ): Promise<void> {
    try {
      // Process only successful events for funnels
      const processingPromises = results
        .filter((result) => result.success)
        .map(async (result, index) => {
          const trackEvent = events[index]
          const enrichment = enrichmentData[index]

          // Transform to the format expected by FunnelRealtimeService
          const eventData = {
            tenant_id: tenant.tenantId.toString(),
            workspace_id: tenant.workspaceId.toString(),
            anonymous_id: trackEvent.anonymous_id,
            lead_id: undefined, // Will be populated if user is identified
            session_id: trackEvent.session_id || '',
            event_name: trackEvent.event_name,
            timestamp: new Date(trackEvent.timestamp),
            page: trackEvent.page,
            utm: trackEvent.utm,
            device: enrichment.device,
            geo: enrichment.geo,
            props: trackEvent.properties,
          }

          // Process individual event against funnels
          await this.funnelRealtime.processEventForFunnels(eventData)
        })

      // Process all successful events in parallel
      await Promise.all(processingPromises)
    } catch (error) {
      // Don't throw - this is background processing
      this.logger.error(
        'Background batch funnel processing error',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId: tenant.tenantId.toString(),
          workspaceId: tenant.workspaceId.toString(),
          batchSize: events.length,
        }
      )
    }
  }
}
