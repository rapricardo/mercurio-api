import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { TenantContext } from '../../common/types/tenant-context.type'
import { TrackEventDto, IdentifyEventDto } from '../dto/track-event.dto'
import { ProcessingResult, BatchProcessingResult } from '../dto/response.dto'
import { MercurioLogger } from '../../common/services/logger.service'
import { MetricsService } from '../../common/services/metrics.service'
import { EncryptionService } from '../../common/services/encryption.service'
import crypto from 'node:crypto'

@Injectable()
export class EventProcessorService {
  private readonly SESSION_TIMEOUT_MINUTES = 30

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
    private readonly encryption: EncryptionService,
  ) {}

  async processTrackEvent(
    event: TrackEventDto,
    context: TenantContext,
    enrichmentData?: any,
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Check for deduplication if event_id provided
      if (event.event_id) {
        const existingEvent = await this.prisma.event.findFirst({
          where: {
            tenantId: context.tenantId,
            eventId: event.event_id,
          },
        });
        
        if (existingEvent) {
          // Record duplicate metric
          this.metrics.incrementCounter('events.duplicates');
          
          // Return success for duplicate (idempotent response)
          this.logger.logDeduplication(event.event_id, {
            tenantId: context.tenantId.toString(),
            workspaceId: context.workspaceId.toString(),
          }, {
            isDuplicate: true,
            existingEventId: existingEvent.id.toString()
          });
          
          return {
            success: true,
            eventId: existingEvent.id.toString(),
            isDuplicate: true,
          };
        }
      }

      // Ensure visitor exists
      const visitor = await this.ensureVisitor(event.anonymous_id, context, enrichmentData)
      
      // Handle session management
      const sessionId = event.session_id || await this.ensureSession(event.anonymous_id, context, enrichmentData)
      
      // Get linked lead if exists
      const leadId = await this.getLinkedLead(event.anonymous_id, context)

      // Create the event
      const eventRecord = await this.prisma.event.create({
        data: {
          eventId: event.event_id || null, // Store client-provided event ID for deduplication
          schemaVersion: enrichmentData?.schemaVersion || '1.0.0',
          eventName: event.event_name,
          timestamp: new Date(event.timestamp),
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
          anonymousId: event.anonymous_id,
          leadId,
          sessionId,
          page: event.page ? {
            url: event.page.url,
            title: event.page.title,
            referrer: event.page.referrer,
            path: event.page.path || new URL(event.page.url).pathname,
          } : undefined,
          utm: event.utm ? JSON.parse(JSON.stringify(event.utm)) : undefined,
          device: enrichmentData?.device || null,
          geo: enrichmentData?.geo || null,
          props: event.properties || {},
          ingestedAt: new Date(),
        },
      })

      const processingTime = Date.now() - startTime

      // Record metrics
      this.metrics.incrementCounter('events.tracked');
      this.metrics.recordLatency('events.processing_latency', processingTime);
      
      this.logger.logEventIngestion(event.event_name, {
        tenantId: context.tenantId.toString(),
        workspaceId: context.workspaceId.toString(),
        eventId: eventRecord.id.toString(),
      }, {
        eventId: event.event_id,
        payloadSize: JSON.stringify(event).length,
        processingTimeMs: processingTime,
        isDuplicate: false
      })

      return {
        success: true,
        eventId: eventRecord.id.toString(),
        sessionId,
        leadId: leadId?.toString(),
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.logger.error('Failed to process track event', 
        error instanceof Error ? error : new Error('Unknown error'),
        {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        },
        {
          category: 'event_processing',
          eventName: event.event_name,
          anonymousId: event.anonymous_id,
          processingTimeMs: processingTime,
        }
      )

      return {
        success: false,
        errors: [{
          field: 'event',
          message: 'Failed to process event',
          value: error instanceof Error ? error.message : 'Unknown error',
        }],
      }
    }
  }

  async processBatchEvents(
    events: TrackEventDto[],
    context: TenantContext,
    enrichmentData?: any[],
  ): Promise<BatchProcessingResult> {
    const results: ProcessingResult[] = []
    let successCount = 0
    let errorCount = 0

    // Process events in parallel with controlled concurrency
    const batchSize = 10
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      const batchEnrichment = enrichmentData?.slice(i, i + batchSize)
      
      const batchPromises = batch.map((event, index) =>
        this.processTrackEvent(event, context, batchEnrichment?.[index])
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      batchResults.forEach((result) => {
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      })
    }

    // Record batch metrics
    this.metrics.incrementCounter('events.batched', events.length);
    
    this.logger.log('Batch processing completed', {
      tenantId: context.tenantId.toString(),
      workspaceId: context.workspaceId.toString(),
    }, {
      category: 'batch_processing',
      total: events.length,
      successful: successCount,
      failed: errorCount,
    })

    return {
      totalProcessed: events.length,
      successCount,
      errorCount,
      results,
    }
  }

  async processIdentifyEvent(
    identify: IdentifyEventDto,
    context: TenantContext,
    enrichmentData?: any,
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Ensure visitor exists
      await this.ensureVisitor(identify.anonymous_id, context, enrichmentData)

      let leadId: bigint | null = null

      if (identify.user_id || identify.traits) {
        // Find or create lead
        const lead = await this.findOrCreateLead(identify, context)
        leadId = lead.id

        // Create or update identity link
        await this.createOrUpdateIdentityLink(identify.anonymous_id, leadId, context)
      }

      const processingTime = Date.now() - startTime
      
      // Record identify metrics
      this.metrics.incrementCounter('events.identified');
      this.metrics.recordLatency('events.processing_latency', processingTime);
      
      this.logger.log('Identity event processed successfully', {
        tenantId: context.tenantId.toString(),
        workspaceId: context.workspaceId.toString(),
      }, {
        category: 'identity_processing',
        anonymousId: identify.anonymous_id,
        leadId: leadId?.toString(),
        processingTimeMs: processingTime,
      })

      return {
        success: true,
        leadId: leadId?.toString(),
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.logger.error('Failed to process identify event',
        error instanceof Error ? error : new Error('Unknown error'),
        {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        },
        {
          category: 'identity_processing',
          anonymousId: identify.anonymous_id,
          processingTimeMs: processingTime,
        }
      )

      return {
        success: false,
        errors: [{
          field: 'identify',
          message: 'Failed to process identity event',
          value: error instanceof Error ? error.message : 'Unknown error',
        }],
      }
    }
  }

  private async ensureVisitor(
    anonymousId: string,
    context: TenantContext,
    enrichmentData?: any,
  ) {
    const existingVisitor = await this.prisma.visitor.findUnique({
      where: { anonymousId },
    })

    if (existingVisitor) {
      // Update last seen and metadata
      return this.prisma.visitor.update({
        where: { anonymousId },
        data: {
          lastSeenAt: new Date(),
          lastDevice: enrichmentData?.device || existingVisitor.lastDevice,
          lastGeo: enrichmentData?.geo || existingVisitor.lastGeo,
          lastUtm: enrichmentData?.utm || existingVisitor.lastUtm,
        },
      })
    }

    // Create new visitor
    return this.prisma.visitor.create({
      data: {
        anonymousId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        firstUtm: enrichmentData?.utm || null,
        lastUtm: enrichmentData?.utm || null,
        lastDevice: enrichmentData?.device || null,
        lastGeo: enrichmentData?.geo || null,
      },
    })
  }

  private async ensureSession(
    anonymousId: string,
    context: TenantContext,
    enrichmentData?: any,
  ): Promise<string> {
    // Find active session (within timeout period)
    const timeoutThreshold = new Date(Date.now() - this.SESSION_TIMEOUT_MINUTES * 60 * 1000)
    
    const activeSession = await this.prisma.session.findFirst({
      where: {
        anonymousId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        startedAt: {
          gte: timeoutThreshold,
        },
        endedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    if (activeSession) {
      return activeSession.sessionId
    }

    // Create new session
    const sessionId = `s_${Date.now()}_${crypto.randomInt(10000, 99999)}`
    
    await this.prisma.session.create({
      data: {
        sessionId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        anonymousId,
        startedAt: new Date(),
        userAgent: enrichmentData?.userAgent || null,
      },
    })

    return sessionId
  }

  private async getLinkedLead(
    anonymousId: string,
    context: TenantContext,
  ): Promise<bigint | null> {
    const identityLink = await this.prisma.identityLink.findFirst({
      where: {
        anonymousId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
      },
      orderBy: {
        lastAt: 'desc',
      },
    })

    return identityLink?.leadId || null
  }

  private async findOrCreateLead(
    identify: IdentifyEventDto,
    context: TenantContext,
  ) {
    if (!identify.user_id && !identify.traits) {
      throw new Error('Either user_id or traits must be provided for identification')
    }

    let emailEnc: string | null = null
    let emailFingerprint: string | null = null
    let emailKeyVersion: number | null = null
    let phoneEnc: string | null = null
    let phoneFingerprint: string | null = null
    let phoneKeyVersion: number | null = null

    // Process email if provided
    if (identify.traits?.email) {
      try {
        const encryptedEmail = await this.encryption.encryptEmail(identify.traits.email);
        emailEnc = encryptedEmail.encrypted;
        emailFingerprint = encryptedEmail.fingerprint;
        emailKeyVersion = encryptedEmail.keyVersion;
        
        this.logger.debug('Email encrypted successfully', {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        }, {
          category: 'encryption',
          operation: 'encrypt',
          type: 'email',
          keyVersion: emailKeyVersion,
        });
      } catch (error) {
        this.logger.error('Failed to encrypt email', error instanceof Error ? error : new Error('Unknown error'), {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        }, {
          category: 'encryption',
          operation: 'encrypt',
          type: 'email',
        });
        throw new Error('Failed to process email data');
      }
    }

    // Process phone if provided  
    if (identify.traits?.phone) {
      try {
        const encryptedPhone = await this.encryption.encryptPhone(identify.traits.phone);
        phoneEnc = encryptedPhone.encrypted;
        phoneFingerprint = encryptedPhone.fingerprint;
        phoneKeyVersion = encryptedPhone.keyVersion;
        
        this.logger.debug('Phone encrypted successfully', {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        }, {
          category: 'encryption',
          operation: 'encrypt',
          type: 'phone',
          keyVersion: phoneKeyVersion,
        });
      } catch (error) {
        this.logger.error('Failed to encrypt phone', error instanceof Error ? error : new Error('Unknown error'), {
          tenantId: context.tenantId.toString(),
          workspaceId: context.workspaceId.toString(),
        }, {
          category: 'encryption',
          operation: 'encrypt',
          type: 'phone',
        });
        throw new Error('Failed to process phone data');
      }
    }

    // Try to find existing lead by email fingerprint first
    if (emailFingerprint) {
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
          emailFingerprint,
        },
      });

      if (existingLead) {
        // Update existing lead with new traits (including phone if provided)
        const updateData: any = {
          updatedAt: new Date(),
        };

        // Update phone data if provided and different
        if (phoneEnc && phoneFingerprint && phoneKeyVersion) {
          updateData.phoneEnc = phoneEnc;
          updateData.phoneFingerprint = phoneFingerprint;
          updateData.phoneKeyVersion = phoneKeyVersion;
        }

        return this.prisma.lead.update({
          where: { id: existingLead.id },
          data: updateData,
        });
      }
    }

    // Try to find existing lead by phone fingerprint if no email match
    if (phoneFingerprint && !emailFingerprint) {
      const existingLead = await this.prisma.lead.findFirst({
        where: {
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
          phoneFingerprint,
        },
      });

      if (existingLead) {
        // Update existing lead with new traits
        return this.prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            updatedAt: new Date(),
          },
        });
      }
    }

    // Create new lead with encrypted PII data
    return this.prisma.lead.create({
      data: {
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        emailEnc,
        emailFingerprint,
        emailKeyVersion,
        phoneEnc,
        phoneFingerprint,
        phoneKeyVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  private async createOrUpdateIdentityLink(
    anonymousId: string,
    leadId: bigint,
    context: TenantContext,
  ) {
    const existingLink = await this.prisma.identityLink.findUnique({
      where: {
        tenantId_workspaceId_anonymousId_leadId: {
          tenantId: context.tenantId,
          workspaceId: context.workspaceId,
          anonymousId,
          leadId,
        },
      },
    })

    if (existingLink) {
      // Update existing link
      return this.prisma.identityLink.update({
        where: {
          tenantId_workspaceId_anonymousId_leadId: {
            tenantId: context.tenantId,
            workspaceId: context.workspaceId,
            anonymousId,
            leadId,
          },
        },
        data: {
          lastAt: new Date(),
        },
      })
    }

    // Create new link
    return this.prisma.identityLink.create({
      data: {
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        anonymousId,
        leadId,
        firstAt: new Date(),
        lastAt: new Date(),
      },
    })
  }
}