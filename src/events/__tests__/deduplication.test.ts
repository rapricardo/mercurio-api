import { Test, TestingModule } from '@nestjs/testing';
import { EventProcessorService } from '../services/event-processor.service';
import { PrismaService } from '../../prisma.service';
import { MercurioLogger } from '../../common/services/logger.service';
import { TenantContext } from '../../common/types/tenant-context.type';
import { TrackEventDto } from '../dto/track-event.dto';

describe('Deduplication Service', () => {
  let eventProcessor: EventProcessorService;
  let prismaService: PrismaService;
  let logger: MercurioLogger;
  let module: TestingModule;

  const mockTenantContext: TenantContext = {
    tenantId: BigInt(1),
    workspaceId: BigInt(1),
    apiKeyId: BigInt(1),
    scopes: ['write', 'events:write'],
  };

  const mockEnrichmentData = {
    device: { type: 'desktop' as const },
    geo: { country: 'BR' },
    userAgent: 'Mozilla/5.0',
    ipAddress: '192.168.1.1',
    ingestedAt: new Date(),
    schemaVersion: '1.0.0',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      event: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      visitor: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      session: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      identityLink: {
        findFirst: jest.fn(),
      },
    };

    const mockLogger = {
      logDeduplication: jest.fn(),
      logEventIngestion: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MercurioLogger, useValue: mockLogger },
      ],
    }).compile();

    eventProcessor = module.get<EventProcessorService>(EventProcessorService);
    prismaService = module.get<PrismaService>(PrismaService);
    logger = module.get<MercurioLogger>(MercurioLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate events using event_id', async () => {
      const eventId = 'evt_unique_12345';
      const trackEvent: TrackEventDto = {
        event_name: 'page_view',
        anonymous_id: 'a_123',
        timestamp: new Date().toISOString(),
        event_id: eventId,
      };

      // Mock existing event found
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue({
        id: BigInt(999),
        eventId: eventId,
        tenantId: mockTenantContext.tenantId,
      });

      const result = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('999');
      expect(result.isDuplicate).toBe(true);
      
      // Verify duplicate check was performed
      expect(prismaService.event.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantContext.tenantId,
          eventId: eventId,
        },
      });

      // Verify event was not created
      expect(prismaService.event.create).not.toHaveBeenCalled();

      // Verify deduplication logging
      expect(logger.logDeduplication).toHaveBeenCalledWith(
        eventId,
        {
          tenantId: mockTenantContext.tenantId.toString(),
          workspaceId: mockTenantContext.workspaceId.toString(),
        },
        {
          isDuplicate: true,
          existingEventId: '999',
        }
      );
    });

    it('should process new events when no duplicate found', async () => {
      const eventId = 'evt_unique_67890';
      const trackEvent: TrackEventDto = {
        event_name: 'button_click',
        anonymous_id: 'a_456',
        timestamp: new Date().toISOString(),
        event_id: eventId,
      };

      // Mock no existing event found
      (prismaService.event.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock visitor exists
      (prismaService.visitor.findUnique as jest.Mock).mockResolvedValue({
        anonymousId: 'a_456',
        tenantId: mockTenantContext.tenantId,
      });

      // Mock visitor update
      (prismaService.visitor.update as jest.Mock).mockResolvedValue({
        anonymousId: 'a_456',
        tenantId: mockTenantContext.tenantId,
      });

      // Mock no active session
      (prismaService.session.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock session creation
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_test_session',
      });

      // Mock no linked lead
      (prismaService.identityLink.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock event creation
      (prismaService.event.create as jest.Mock).mockResolvedValue({
        id: BigInt(1001),
        eventId: eventId,
        tenantId: mockTenantContext.tenantId,
      });

      const result = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('1001');
      expect(result.isDuplicate).toBeUndefined();

      // Verify duplicate check was performed
      expect(prismaService.event.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantContext.tenantId,
          eventId: eventId,
        },
      });

      // Verify event was created
      expect(prismaService.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: eventId,
          tenantId: mockTenantContext.tenantId,
        }),
      });
    });

    it('should skip deduplication check when event_id is not provided', async () => {
      const trackEvent: TrackEventDto = {
        event_name: 'page_view',
        anonymous_id: 'a_789',
        timestamp: new Date().toISOString(),
        // No event_id provided
      };

      // Mock visitor exists
      (prismaService.visitor.findUnique as jest.Mock).mockResolvedValue({
        anonymousId: 'a_789',
        tenantId: mockTenantContext.tenantId,
      });

      (prismaService.visitor.update as jest.Mock).mockResolvedValue({
        anonymousId: 'a_789',
        tenantId: mockTenantContext.tenantId,
      });

      (prismaService.session.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_test_session',
      });
      (prismaService.identityLink.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock event creation
      (prismaService.event.create as jest.Mock).mockResolvedValue({
        id: BigInt(2001),
        eventId: null,
        tenantId: mockTenantContext.tenantId,
      });

      const result = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('2001');
      expect(result.isDuplicate).toBeUndefined();

      // Verify no duplicate check was performed
      expect(prismaService.event.findFirst).not.toHaveBeenCalled();

      // Verify event was created with null eventId
      expect(prismaService.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: null,
          tenantId: mockTenantContext.tenantId,
        }),
      });
    });
  });

  describe('Tenant Isolation in Deduplication', () => {
    it('should isolate deduplication by tenant', async () => {
      const eventId = 'evt_shared_id';
      const tenant1Context: TenantContext = {
        tenantId: BigInt(1),
        workspaceId: BigInt(1),
        apiKeyId: BigInt(1),
        scopes: ['write'],
      };

      const tenant2Context: TenantContext = {
        tenantId: BigInt(2),
        workspaceId: BigInt(2),
        apiKeyId: BigInt(2),
        scopes: ['write'],
      };

      const trackEvent: TrackEventDto = {
        event_name: 'shared_event',
        anonymous_id: 'a_shared',
        timestamp: new Date().toISOString(),
        event_id: eventId,
      };

      // First call for tenant 1 - no existing event
      (prismaService.event.findFirst as jest.Mock).mockResolvedValueOnce(null);
      
      // Mock setup for successful event creation
      (prismaService.visitor.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.visitor.create as jest.Mock).mockResolvedValue({
        anonymousId: 'a_shared',
        tenantId: tenant1Context.tenantId,
      });
      (prismaService.session.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_session_1',
      });
      (prismaService.identityLink.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.event.create as jest.Mock).mockResolvedValueOnce({
        id: BigInt(1001),
        eventId: eventId,
        tenantId: tenant1Context.tenantId,
      });

      // Process for tenant 1
      const result1 = await eventProcessor.processTrackEvent(
        trackEvent,
        tenant1Context,
        mockEnrichmentData
      );

      expect(result1.success).toBe(true);
      expect(result1.isDuplicate).toBeUndefined();

      // Second call for tenant 2 - should also succeed (different tenant)
      (prismaService.event.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prismaService.visitor.create as jest.Mock).mockResolvedValue({
        anonymousId: 'a_shared',
        tenantId: tenant2Context.tenantId,
      });
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_session_2',
      });
      (prismaService.event.create as jest.Mock).mockResolvedValueOnce({
        id: BigInt(2001),
        eventId: eventId,
        tenantId: tenant2Context.tenantId,
      });

      const result2 = await eventProcessor.processTrackEvent(
        trackEvent,
        tenant2Context,
        mockEnrichmentData
      );

      expect(result2.success).toBe(true);
      expect(result2.isDuplicate).toBeUndefined();

      // Verify both duplicate checks were tenant-specific
      expect(prismaService.event.findFirst).toHaveBeenCalledTimes(2);
      expect(prismaService.event.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          tenantId: tenant1Context.tenantId,
          eventId: eventId,
        },
      });
      expect(prismaService.event.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: tenant2Context.tenantId,
          eventId: eventId,
        },
      });
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle concurrent duplicate submissions gracefully', async () => {
      const eventId = 'evt_concurrent_test';
      const trackEvent: TrackEventDto = {
        event_name: 'concurrent_event',
        anonymous_id: 'a_concurrent',
        timestamp: new Date().toISOString(),
        event_id: eventId,
      };

      // First call - no duplicate found initially
      (prismaService.event.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Mock successful creation for first call
      (prismaService.visitor.findUnique as jest.Mock).mockResolvedValue({
        anonymousId: 'a_concurrent',
        tenantId: mockTenantContext.tenantId,
      });
      (prismaService.visitor.update as jest.Mock).mockResolvedValue({
        anonymousId: 'a_concurrent',
        tenantId: mockTenantContext.tenantId,
      });
      (prismaService.session.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_concurrent_session',
      });
      (prismaService.identityLink.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.event.create as jest.Mock).mockResolvedValueOnce({
        id: BigInt(3001),
        eventId: eventId,
        tenantId: mockTenantContext.tenantId,
      });

      // Process first request
      const result1 = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result1.success).toBe(true);
      expect(result1.isDuplicate).toBeUndefined();

      // Second concurrent call - should find the duplicate
      (prismaService.event.findFirst as jest.Mock).mockResolvedValueOnce({
        id: BigInt(3001),
        eventId: eventId,
        tenantId: mockTenantContext.tenantId,
      });

      const result2 = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result2.success).toBe(true);
      expect(result2.eventId).toBe('3001');
      expect(result2.isDuplicate).toBe(true);

      // Verify creation was only called once
      expect(prismaService.event.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Batch Deduplication', () => {
    it('should handle deduplication in batch events', async () => {
      const events = [
        {
          event_name: 'event_1',
          anonymous_id: 'a_batch',
          timestamp: new Date().toISOString(),
          event_id: 'evt_batch_1',
        },
        {
          event_name: 'event_2',
          anonymous_id: 'a_batch',
          timestamp: new Date().toISOString(),
          event_id: 'evt_batch_2',
        },
        {
          event_name: 'event_1', // Duplicate of first event
          anonymous_id: 'a_batch',
          timestamp: new Date().toISOString(),
          event_id: 'evt_batch_1',
        },
      ];

      // Mock for first event - new
      (prismaService.event.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // First event - not duplicate
        .mockResolvedValueOnce(null) // Second event - not duplicate
        .mockResolvedValueOnce({ // Third event - is duplicate
          id: BigInt(4001),
          eventId: 'evt_batch_1',
          tenantId: mockTenantContext.tenantId,
        });

      // Mock successful visitor and session handling
      (prismaService.visitor.findUnique as jest.Mock).mockResolvedValue({
        anonymousId: 'a_batch',
        tenantId: mockTenantContext.tenantId,
      });
      (prismaService.visitor.update as jest.Mock).mockResolvedValue({
        anonymousId: 'a_batch',
        tenantId: mockTenantContext.tenantId,
      });
      (prismaService.session.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.session.create as jest.Mock).mockResolvedValue({
        sessionId: 's_batch_session',
      });
      (prismaService.identityLink.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock event creation for new events
      (prismaService.event.create as jest.Mock)
        .mockResolvedValueOnce({
          id: BigInt(4001),
          eventId: 'evt_batch_1',
          tenantId: mockTenantContext.tenantId,
        })
        .mockResolvedValueOnce({
          id: BigInt(4002),
          eventId: 'evt_batch_2',
          tenantId: mockTenantContext.tenantId,
        });

      const enrichmentData = [mockEnrichmentData, mockEnrichmentData, mockEnrichmentData];

      const result = await eventProcessor.processBatchEvents(
        events,
        mockTenantContext,
        enrichmentData
      );

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(3);

      // First event should be new
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].isDuplicate).toBeUndefined();

      // Second event should be new
      expect(result.results[1].success).toBe(true);
      expect(result.results[1].isDuplicate).toBeUndefined();

      // Third event should be duplicate
      expect(result.results[2].success).toBe(true);
      expect(result.results[2].isDuplicate).toBe(true);
      expect(result.results[2].eventId).toBe('4001');

      // Verify deduplication checks were performed
      expect(prismaService.event.findFirst).toHaveBeenCalledTimes(3);

      // Verify only 2 events were created (not the duplicate)
      expect(prismaService.event.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during duplicate check', async () => {
      const eventId = 'evt_error_test';
      const trackEvent: TrackEventDto = {
        event_name: 'error_event',
        anonymous_id: 'a_error',
        timestamp: new Date().toISOString(),
        event_id: eventId,
      };

      // Mock database error during duplicate check
      (prismaService.event.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await eventProcessor.processTrackEvent(
        trackEvent,
        mockTenantContext,
        mockEnrichmentData
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field).toBe('event');
      expect(result.errors![0].message).toBe('Failed to process event');

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to process track event',
        expect.any(Error),
        expect.objectContaining({
          tenantId: mockTenantContext.tenantId.toString(),
        }),
        expect.objectContaining({
          category: 'event_processing',
        })
      );
    });
  });
});