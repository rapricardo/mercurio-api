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
import { ApiKeyGuard, RequireScopes } from '../../common/auth/api-key.guard'
import { RateLimitGuard, RateLimit } from '../../common/guards/rate-limit.guard'
import { CurrentTenant } from '../../common/context/tenant-context.provider'
import { TenantContext } from '../../common/types/tenant-context.type'
import { TrackEventDto, BatchEventDto, IdentifyEventDto } from '../dto/track-event.dto'
import { EventResponse, BatchResponse, IdentifyResponse } from '../dto/response.dto'
import { EventProcessorService } from '../services/event-processor.service'
import { EnrichmentService } from '../services/enrichment.service'
import { MercurioLogger } from '../../common/services/logger.service'
import { REQUEST_CONTEXT_KEY } from '../../common/middleware/request-context.middleware'

@Controller('v1/events')
@UseGuards(ApiKeyGuard, RateLimitGuard)
export class EventsController {
  private readonly MAX_BATCH_SIZE = 50           // Sprint 1: Reduced from 1000
  private readonly MAX_PAYLOAD_SIZE = 256 * 1024  // Sprint 1: 256KB (reduced from 1MB)

  constructor(
    private readonly eventProcessor: EventProcessorService,
    private readonly enrichment: EnrichmentService,
    private readonly logger: MercurioLogger,
  ) {}

  @Post('track')
  @HttpCode(HttpStatus.OK)
  @RequireScopes(['write', 'events:write'])
  @RateLimit({ endpoint: 'events' })
  async trackEvent(
    @Body() trackEvent: TrackEventDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() request: FastifyRequest,
  ): Promise<EventResponse> {
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
      this.logger.error('Track event processing failed', undefined, {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      }, {
        category: 'api_endpoint',
        endpoint: 'track',
        eventName: trackEvent.event_name,
        errors: result.errors,
      })

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

    // Log successful processing
    this.logger.log('Track event processed successfully', {
      requestId: requestContext?.requestId,
      tenantId: tenant.tenantId.toString(),
      workspaceId: tenant.workspaceId.toString(),
      eventId: result.eventId,
    }, {
      category: 'api_endpoint', 
      endpoint: 'track',
      eventName: trackEvent.event_name,
      isDuplicate: result.isDuplicate,
      payloadSize,
    })

    return {
      accepted: true,
      event_id: result.eventId,
      is_duplicate: result.isDuplicate,
    }
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @RequireScopes(['write', 'events:write'])
  @RateLimit({ endpoint: 'events' })
  async batchEvents(
    @Body() batchDto: BatchEventDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() request: FastifyRequest,
  ): Promise<BatchResponse> {
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

    // Transform results to response format
    const results: EventResponse[] = batchResult.results.map((result) => ({
      accepted: result.success,
      event_id: result.eventId,
      is_duplicate: result.isDuplicate,
      errors: result.errors,
    }))

    // Log batch processing results
    this.logger.log('Batch events processed', {
      requestId: requestContext?.requestId,
      tenantId: tenant.tenantId.toString(),
      workspaceId: tenant.workspaceId.toString(),
    }, {
      category: 'api_endpoint',
      endpoint: 'batch',
      totalEvents: batchResult.totalProcessed,
      successful: batchResult.successCount,
      failed: batchResult.errorCount,
      payloadSize: JSON.stringify(batchDto).length,
      duplicates: results.filter(r => r.is_duplicate).length,
    })

    return {
      accepted: batchResult.successCount,
      rejected: batchResult.errorCount,
      total: batchResult.totalProcessed,
      results,
    }
  }

  @Post('identify')
  @HttpCode(HttpStatus.OK)
  @RequireScopes(['write', 'events:write'])
  @RateLimit({ endpoint: 'events' })
  async identifyUser(
    @Body() identifyDto: IdentifyEventDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() request: FastifyRequest,
  ): Promise<IdentifyResponse> {
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
    const result = await this.eventProcessor.processIdentifyEvent(identifyDto, tenant, enrichmentData)

    if (!result.success) {
      // Log identification failure
      this.logger.error('Identity event processing failed', undefined, {
        requestId: requestContext?.requestId,
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
      }, {
        category: 'api_endpoint',
        endpoint: 'identify',
        anonymousId: identifyDto.anonymous_id,
        errors: result.errors,
      })

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
    this.logger.log('Identity event processed successfully', {
      requestId: requestContext?.requestId,
      tenantId: tenant.tenantId.toString(),
      workspaceId: tenant.workspaceId.toString(),
      leadId: result.leadId,
    }, {
      category: 'api_endpoint',
      endpoint: 'identify',
      anonymousId: identifyDto.anonymous_id,
      hasEmail: !!identifyDto.traits?.email,
      hasUserId: !!identifyDto.user_id,
      payloadSize,
    })

    return {
      accepted: true,
      lead_id: result.leadId,
    }
  }
}