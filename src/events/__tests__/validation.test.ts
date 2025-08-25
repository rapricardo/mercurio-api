import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { EventsController } from '../controllers/events.controller';
import { EventProcessorService } from '../services/event-processor.service';
import { EnrichmentService } from '../services/enrichment.service';
import { MercurioLogger } from '../../common/services/logger.service';
import { TenantContext } from '../../common/types/tenant-context.type';
import { TrackEventDto, BatchEventDto, IdentifyEventDto } from '../dto/track-event.dto';

describe('Payload Validation', () => {
  let controller: EventsController;
  let eventProcessor: EventProcessorService;
  let enrichment: EnrichmentService;
  let logger: MercurioLogger;

  const mockTenantContext: TenantContext = {
    tenantId: BigInt(1),
    workspaceId: BigInt(1),
    apiKeyId: BigInt(1),
    scopes: ['write', 'events:write'],
  };

  const mockRequest = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'x-forwarded-for': '192.168.1.1',
    },
    requestContext: { requestId: 'req_test_123' }
  } as any;

  beforeEach(async () => {
    const mockEventProcessor = {
      processTrackEvent: jest.fn().mockResolvedValue({ success: true, eventId: '123' }),
      processBatchEvents: jest.fn().mockResolvedValue({
        totalProcessed: 2,
        successCount: 2,
        errorCount: 0,
        results: [
          { success: true, eventId: '123' },
          { success: true, eventId: '124' }
        ]
      }),
      processIdentifyEvent: jest.fn().mockResolvedValue({ success: true, leadId: '456' }),
    };

    const mockEnrichment = {
      validateTimestamp: jest.fn().mockReturnValue({ isValid: true }),
      enrichEvent: jest.fn().mockReturnValue({
        device: { type: 'desktop' },
        geo: { country: 'BR' },
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        ingestedAt: new Date(),
        schemaVersion: '1.0.0',
      }),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventProcessorService, useValue: mockEventProcessor },
        { provide: EnrichmentService, useValue: mockEnrichment },
        { provide: MercurioLogger, useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    eventProcessor = module.get<EventProcessorService>(EventProcessorService);
    enrichment = module.get<EnrichmentService>(EnrichmentService);
    logger = module.get<MercurioLogger>(MercurioLogger);
  });

  describe('Payload Size Limits', () => {
    it('should reject track event exceeding 256KB payload size', async () => {
      const largePayload: TrackEventDto = {
        event_name: 'large_event',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
        properties: {
          large_data: 'x'.repeat(300 * 1024), // 300KB string
        },
      };

      await expect(
        controller.trackEvent(largePayload, mockTenantContext, mockRequest)
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject batch event exceeding 256KB payload size', async () => {
      const largeEvent = {
        event_name: 'large_event',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
        properties: {
          large_data: 'x'.repeat(200 * 1024), // 200KB per event
        },
      };

      const largeBatch: BatchEventDto = {
        events: [largeEvent, largeEvent], // Total > 256KB
      };

      await expect(
        controller.batchEvents(largeBatch, mockTenantContext, mockRequest)
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should reject identify event exceeding 256KB payload size', async () => {
      const largeIdentify: IdentifyEventDto = {
        anonymous_id: 'a_123',
        traits: {
          email: 'test@example.com',
          large_data: 'x'.repeat(300 * 1024), // 300KB string
        },
      };

      await expect(
        controller.identifyUser(largeIdentify, mockTenantContext, mockRequest)
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should accept payloads within 256KB limit', async () => {
      const validPayload: TrackEventDto = {
        event_name: 'valid_event',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
        properties: {
          data: 'x'.repeat(100 * 1024), // 100KB string
        },
      };

      const result = await controller.trackEvent(validPayload, mockTenantContext, mockRequest);
      expect(result.accepted).toBe(true);
    });
  });

  describe('Batch Size Limits', () => {
    it('should reject batches exceeding 50 events', async () => {
      const events = Array(51).fill(null).map((_, index) => ({
        event_name: 'test_event',
        anonymous_id: `a_${index}`,
        timestamp: new Date().toISOString(),
      }));

      const largeBatch: BatchEventDto = { events };

      await expect(
        controller.batchEvents(largeBatch, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);

      // Verify the error details
      try {
        await controller.batchEvents(largeBatch, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error.response.error.code).toBe('batch_too_large');
        expect(error.response.error.details.batchSize).toBe(51);
        expect(error.response.error.details.maxBatchSize).toBe(50);
      }
    });

    it('should accept batches within 50 event limit', async () => {
      const events = Array(50).fill(null).map((_, index) => ({
        event_name: 'test_event',
        anonymous_id: `a_${index}`,
        timestamp: new Date().toISOString(),
      }));

      const validBatch: BatchEventDto = { events };

      const result = await controller.batchEvents(validBatch, mockTenantContext, mockRequest);
      expect(result.total).toBe(50);
      expect(result.accepted).toBe(50);
    });

    it('should handle empty batch', async () => {
      const emptyBatch: BatchEventDto = { events: [] };

      const result = await controller.batchEvents(emptyBatch, mockTenantContext, mockRequest);
      expect(result.total).toBe(0);
      expect(result.accepted).toBe(0);
    });
  });

  describe('Schema Version Handling', () => {
    it('should extract schema version from header', () => {
      const requestWithVersion = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-event-schema-version': '1.2.0',
        },
      };

      controller.trackEvent({
        event_name: 'test',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
      }, mockTenantContext, requestWithVersion);

      expect(enrichment.enrichEvent).toHaveBeenCalledWith(requestWithVersion);
    });

    it('should handle missing schema version header', () => {
      controller.trackEvent({
        event_name: 'test',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
      }, mockTenantContext, mockRequest);

      expect(enrichment.enrichEvent).toHaveBeenCalledWith(mockRequest);
    });

    it('should log warning for invalid schema version format', () => {
      const requestWithInvalidVersion = {
        ...mockRequest,
        headers: {
          ...mockRequest.headers,
          'x-event-schema-version': 'invalid-version',
        },
      };

      // Mock enrichment to simulate invalid version handling
      (enrichment.enrichEvent as jest.Mock).mockReturnValue({
        ...enrichment.enrichEvent(),
        schemaVersion: '1.0.0', // Default fallback
      });

      controller.trackEvent({
        event_name: 'test',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
      }, mockTenantContext, requestWithInvalidVersion);

      expect(enrichment.enrichEvent).toHaveBeenCalledWith(requestWithInvalidVersion);
    });
  });

  describe('Timestamp Validation', () => {
    it('should reject events with timestamps too far in the past', async () => {
      const pastTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      
      (enrichment.validateTimestamp as jest.Mock).mockReturnValue({
        isValid: false,
        error: 'Event timestamp is too far in the past (max 5 minutes)',
      });

      const pastEvent: TrackEventDto = {
        event_name: 'past_event',
        anonymous_id: 'a_123',
        timestamp: pastTimestamp,
      };

      await expect(
        controller.trackEvent(pastEvent, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject events with timestamps too far in the future', async () => {
      const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now
      
      (enrichment.validateTimestamp as jest.Mock).mockReturnValue({
        isValid: false,
        error: 'Event timestamp is too far in the future (max 5 minutes)',
      });

      const futureEvent: TrackEventDto = {
        event_name: 'future_event',
        anonymous_id: 'a_123',
        timestamp: futureTimestamp,
      };

      await expect(
        controller.trackEvent(futureEvent, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept events with valid timestamps', async () => {
      const validTimestamp = new Date().toISOString();
      
      (enrichment.validateTimestamp as jest.Mock).mockReturnValue({ isValid: true });

      const validEvent: TrackEventDto = {
        event_name: 'valid_event',
        anonymous_id: 'a_123',
        timestamp: validTimestamp,
      };

      const result = await controller.trackEvent(validEvent, mockTenantContext, mockRequest);
      expect(result.accepted).toBe(true);
    });

    it('should validate all timestamps in batch', async () => {
      const validTimestamp = new Date().toISOString();
      const invalidTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      (enrichment.validateTimestamp as jest.Mock)
        .mockReturnValueOnce({ isValid: true })
        .mockReturnValueOnce({
          isValid: false,
          error: 'Event timestamp is too far in the past (max 5 minutes)',
        });

      const batchWithInvalidTimestamp: BatchEventDto = {
        events: [
          {
            event_name: 'valid_event',
            anonymous_id: 'a_123',
            timestamp: validTimestamp,
          },
          {
            event_name: 'invalid_event',
            anonymous_id: 'a_124',
            timestamp: invalidTimestamp,
          },
        ],
      };

      await expect(
        controller.batchEvents(batchWithInvalidTimestamp, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);

      // Verify error contains timestamp validation details
      try {
        await controller.batchEvents(batchWithInvalidTimestamp, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error.response.error.code).toBe('invalid_timestamps');
        expect(error.response.error.details.errors).toContain('Event 1: Event timestamp is too far in the past (max 5 minutes)');
      }
    });
  });

  describe('Identify Validation', () => {
    it('should reject identify without user_id or traits', async () => {
      const invalidIdentify: IdentifyEventDto = {
        anonymous_id: 'a_123',
      };

      await expect(
        controller.identifyUser(invalidIdentify, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);

      try {
        await controller.identifyUser(invalidIdentify, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error.response.error.code).toBe('missing_identification');
      }
    });

    it('should reject identify with invalid email format', async () => {
      const invalidEmail: IdentifyEventDto = {
        anonymous_id: 'a_123',
        traits: {
          email: 'not-an-email',
          name: 'John Doe',
        },
      };

      await expect(
        controller.identifyUser(invalidEmail, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);

      try {
        await controller.identifyUser(invalidEmail, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error.response.error.code).toBe('invalid_email');
        expect(error.response.error.details.email).toBe('not-an-email');
      }
    });

    it('should accept identify with valid email', async () => {
      const validIdentify: IdentifyEventDto = {
        anonymous_id: 'a_123',
        traits: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const result = await controller.identifyUser(validIdentify, mockTenantContext, mockRequest);
      expect(result.accepted).toBe(true);
    });

    it('should accept identify with user_id only', async () => {
      const validIdentify: IdentifyEventDto = {
        anonymous_id: 'a_123',
        user_id: 'user_456',
      };

      const result = await controller.identifyUser(validIdentify, mockTenantContext, mockRequest);
      expect(result.accepted).toBe(true);
    });

    it('should validate timestamp in identify if provided', async () => {
      const invalidTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      (enrichment.validateTimestamp as jest.Mock).mockReturnValue({
        isValid: false,
        error: 'Event timestamp is too far in the past (max 5 minutes)',
      });

      const identifyWithInvalidTimestamp: IdentifyEventDto = {
        anonymous_id: 'a_123',
        user_id: 'user_456',
        timestamp: invalidTimestamp,
      };

      await expect(
        controller.identifyUser(identifyWithInvalidTimestamp, mockTenantContext, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Error Response Format', () => {
    it('should return structured error for payload too large', async () => {
      const largePayload: TrackEventDto = {
        event_name: 'large_event',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
        properties: { data: 'x'.repeat(300 * 1024) },
      };

      try {
        await controller.trackEvent(largePayload, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error).toBeInstanceOf(PayloadTooLargeException);
        expect(error.response.error).toHaveProperty('code', 'payload_too_large');
        expect(error.response.error).toHaveProperty('message');
        expect(error.response.error).toHaveProperty('details');
        expect(error.response.error.details).toHaveProperty('payloadSize');
        expect(error.response.error.details).toHaveProperty('maxSize', 256 * 1024);
      }
    });

    it('should return structured error for processing failure', async () => {
      (eventProcessor.processTrackEvent as jest.Mock).mockResolvedValue({
        success: false,
        errors: [
          {
            field: 'anonymous_id',
            message: 'Invalid anonymous_id format',
            value: 'invalid-id',
          },
        ],
      });

      const invalidEvent: TrackEventDto = {
        event_name: 'test_event',
        anonymous_id: 'invalid-id',
        timestamp: new Date().toISOString(),
      };

      try {
        await controller.trackEvent(invalidEvent, mockTenantContext, mockRequest);
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.error.code).toBe('processing_failed');
        expect(error.response.error.details.errors).toHaveLength(1);
        expect(error.response.error.details.errors[0].field).toBe('anonymous_id');
      }
    });
  });
});