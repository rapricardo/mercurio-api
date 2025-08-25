import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '../../src/prisma.service';
import { AppModule } from '../../src/app.module';
import { EncryptionService } from '../../src/common/services/encryption.service';
import { EventProcessorService } from '../../src/events/services/event-processor.service';
import { IdentifyEventDto } from '../../src/events/dto/track-event.dto';
import { TenantContext } from '../../src/common/types/tenant-context.type';
import { randomUUID } from 'crypto';

describe('PII Encryption Integration Tests', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let encryption: EncryptionService;
  let eventProcessor: EventProcessorService;
  let testTenantId: bigint;
  let testWorkspaceId: bigint;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEK_SECRET = 'dGVzdC1rZWstc2VjcmV0LWZvci10ZXN0aW5nLW9ubHk=';
    process.env.EMAIL_DEK_SECRET = 'dGVzdC1lbWFpbC1kZWstc2VjcmV0LWZvci10ZXN0aW5n';
    process.env.PHONE_DEK_SECRET = 'dGVzdC1waG9uZS1kZWstc2VjcmV0LWZvci10ZXN0aW5n';
    process.env.EMAIL_FINGERPRINT_SECRET = 'dGVzdC1lbWFpbC1maW5nZXJwcmludC1zZWNyZXQ=';
    process.env.PHONE_FINGERPRINT_SECRET = 'dGVzdC1waG9uZS1maW5nZXJwcmludC1zZWNyZXQ=';
    process.env.ENCRYPTION_KEY_VERSION = '1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    encryption = moduleFixture.get<EncryptionService>(EncryptionService);
    eventProcessor = moduleFixture.get<EventProcessorService>(EventProcessorService);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Create test tenant and workspace
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Encryption Test Tenant',
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        tenantId: tenant.id,
        name: 'Encryption Test Workspace',
      },
    });

    testTenantId = tenant.id;
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.lead.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.identityLink.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.workspace.delete({
      where: { id: testWorkspaceId }
    });
    await prisma.tenant.delete({
      where: { id: testTenantId }
    });

    await app.close();

    // Clean up environment variables
    delete process.env.ENCRYPTION_KEK_SECRET;
    delete process.env.EMAIL_DEK_SECRET;
    delete process.env.PHONE_DEK_SECRET;
    delete process.env.EMAIL_FINGERPRINT_SECRET;
    delete process.env.PHONE_FINGERPRINT_SECRET;
    delete process.env.ENCRYPTION_KEY_VERSION;
  });

  describe('EncryptionService Integration', () => {
    it('should encrypt and decrypt email addresses correctly', async () => {
      const testEmail = 'test@example.com';
      
      const encrypted = await encryption.encryptEmail(testEmail);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.fingerprint).toBeDefined();
      expect(encrypted.keyVersion).toBe(1);

      const decrypted = await encryption.decryptEmail(encrypted.encrypted, encrypted.keyVersion);
      expect(decrypted).toBe(testEmail);
    });

    it('should encrypt and decrypt phone numbers correctly', async () => {
      const testPhone = '+1234567890';
      
      const encrypted = await encryption.encryptPhone(testPhone);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.fingerprint).toBeDefined();
      expect(encrypted.keyVersion).toBe(1);

      const decrypted = await encryption.decryptPhone(encrypted.encrypted, encrypted.keyVersion);
      expect(decrypted).toBe(testPhone);
    });

    it('should generate consistent fingerprints for same data', () => {
      const testEmail = 'test@example.com';
      
      const fingerprint1 = encryption.generateFingerprint(testEmail, 'email');
      const fingerprint2 = encryption.generateFingerprint(testEmail, 'email');
      
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should pass health check', async () => {
      const isHealthy = await encryption.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Lead Processing with Encryption', () => {
    const context: TenantContext = {
      tenantId: testTenantId,
      workspaceId: testWorkspaceId,
    };

    it('should create lead with encrypted email', async () => {
      const identifyEvent: IdentifyEventDto = {
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        traits: {
          email: 'encrypted-test@example.com',
          name: 'Test User',
        },
      };

      const result = await eventProcessor.processIdentifyEvent(identifyEvent, context);

      expect(result.success).toBe(true);
      expect(result.leadId).toBeDefined();

      // Verify lead was created with encrypted data
      const lead = await prisma.lead.findUnique({
        where: { id: BigInt(result.leadId!) },
      });

      expect(lead).toBeTruthy();
      expect(lead!.emailEnc).toBeDefined();
      expect(lead!.emailFingerprint).toBeDefined();
      expect(lead!.emailKeyVersion).toBe(1);

      // Verify we can decrypt the email
      const decryptedEmail = await encryption.decryptEmail(lead!.emailEnc!, lead!.emailKeyVersion!);
      expect(decryptedEmail).toBe('encrypted-test@example.com');
    });

    it('should create lead with encrypted phone', async () => {
      const identifyEvent: IdentifyEventDto = {
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        traits: {
          phone: '+1987654321',
          name: 'Phone Test User',
        },
      };

      const result = await eventProcessor.processIdentifyEvent(identifyEvent, context);

      expect(result.success).toBe(true);
      expect(result.leadId).toBeDefined();

      // Verify lead was created with encrypted phone data
      const lead = await prisma.lead.findUnique({
        where: { id: BigInt(result.leadId!) },
      });

      expect(lead).toBeTruthy();
      expect(lead!.phoneEnc).toBeDefined();
      expect(lead!.phoneFingerprint).toBeDefined();
      expect(lead!.phoneKeyVersion).toBe(1);

      // Verify we can decrypt the phone
      const decryptedPhone = await encryption.decryptPhone(lead!.phoneEnc!, lead!.phoneKeyVersion!);
      expect(decryptedPhone).toBe('+1987654321');
    });

    it('should create lead with both encrypted email and phone', async () => {
      const identifyEvent: IdentifyEventDto = {
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        traits: {
          email: 'both-test@example.com',
          phone: '+1555666777',
          name: 'Both Test User',
        },
      };

      const result = await eventProcessor.processIdentifyEvent(identifyEvent, context);

      expect(result.success).toBe(true);
      expect(result.leadId).toBeDefined();

      // Verify lead was created with both encrypted data types
      const lead = await prisma.lead.findUnique({
        where: { id: BigInt(result.leadId!) },
      });

      expect(lead).toBeTruthy();
      expect(lead!.emailEnc).toBeDefined();
      expect(lead!.emailFingerprint).toBeDefined();
      expect(lead!.emailKeyVersion).toBe(1);
      expect(lead!.phoneEnc).toBeDefined();
      expect(lead!.phoneFingerprint).toBeDefined();
      expect(lead!.phoneKeyVersion).toBe(1);

      // Verify we can decrypt both
      const decryptedEmail = await encryption.decryptEmail(lead!.emailEnc!, lead!.emailKeyVersion!);
      const decryptedPhone = await encryption.decryptPhone(lead!.phoneEnc!, lead!.phoneKeyVersion!);
      
      expect(decryptedEmail).toBe('both-test@example.com');
      expect(decryptedPhone).toBe('+1555666777');
    });

    it('should find existing lead by email fingerprint', async () => {
      const email = 'existing-user@example.com';
      const anonymousId1 = randomUUID();
      const anonymousId2 = randomUUID();

      // Create first identify event
      const identifyEvent1: IdentifyEventDto = {
        anonymous_id: anonymousId1,
        timestamp: new Date().toISOString(),
        traits: {
          email,
          name: 'Existing User',
        },
      };

      const result1 = await eventProcessor.processIdentifyEvent(identifyEvent1, context);
      expect(result1.success).toBe(true);

      // Create second identify event with same email but different anonymous ID
      const identifyEvent2: IdentifyEventDto = {
        anonymous_id: anonymousId2,
        timestamp: new Date().toISOString(),
        traits: {
          email,
          phone: '+1000111222', // Add phone to test update
        },
      };

      const result2 = await eventProcessor.processIdentifyEvent(identifyEvent2, context);
      expect(result2.success).toBe(true);

      // Should return the same lead ID
      expect(result1.leadId).toBe(result2.leadId);

      // Verify the lead was updated with phone data
      const lead = await prisma.lead.findUnique({
        where: { id: BigInt(result2.leadId!) },
      });

      expect(lead!.phoneEnc).toBeDefined();
      expect(lead!.phoneFingerprint).toBeDefined();
    });

    it('should find existing lead by phone fingerprint when no email', async () => {
      const phone = '+9999888777';
      const anonymousId1 = randomUUID();
      const anonymousId2 = randomUUID();

      // Create first identify event with phone only
      const identifyEvent1: IdentifyEventDto = {
        anonymous_id: anonymousId1,
        timestamp: new Date().toISOString(),
        traits: {
          phone,
          name: 'Phone Only User',
        },
      };

      const result1 = await eventProcessor.processIdentifyEvent(identifyEvent1, context);
      expect(result1.success).toBe(true);

      // Create second identify event with same phone
      const identifyEvent2: IdentifyEventDto = {
        anonymous_id: anonymousId2,
        timestamp: new Date().toISOString(),
        traits: {
          phone,
          name: 'Updated Phone User',
        },
      };

      const result2 = await eventProcessor.processIdentifyEvent(identifyEvent2, context);
      expect(result2.success).toBe(true);

      // Should return the same lead ID
      expect(result1.leadId).toBe(result2.leadId);
    });
  });

  describe('Encryption Error Handling', () => {
    it('should handle encryption failures gracefully', async () => {
      // Create a corrupted encryption service for testing
      const originalEncryptEmail = encryption.encryptEmail;
      encryption.encryptEmail = jest.fn().mockRejectedValue(new Error('Mock encryption failure'));

      const identifyEvent: IdentifyEventDto = {
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        traits: {
          email: 'will-fail@example.com',
        },
      };

      const context: TenantContext = {
        tenantId: testTenantId,
        workspaceId: testWorkspaceId,
      };

      const result = await eventProcessor.processIdentifyEvent(identifyEvent, context);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Failed to process email data');

      // Restore original method
      encryption.encryptEmail = originalEncryptEmail;
    });
  });

  describe('Security Properties', () => {
    it('should never store plaintext PII data', async () => {
      const identifyEvent: IdentifyEventDto = {
        anonymous_id: randomUUID(),
        timestamp: new Date().toISOString(),
        traits: {
          email: 'security-test@example.com',
          phone: '+1234567890',
        },
      };

      const context: TenantContext = {
        tenantId: testTenantId,
        workspaceId: testWorkspaceId,
      };

      const result = await eventProcessor.processIdentifyEvent(identifyEvent, context);
      expect(result.success).toBe(true);

      // Get lead from database
      const lead = await prisma.lead.findUnique({
        where: { id: BigInt(result.leadId!) },
      });

      // Verify plaintext data is not stored
      expect(lead!.emailEnc).not.toBe('security-test@example.com');
      expect(lead!.phoneEnc).not.toBe('+1234567890');
      
      // Verify encrypted data is not obviously plaintext
      expect(lead!.emailEnc).not.toContain('security-test@example.com');
      expect(lead!.phoneEnc).not.toContain('+1234567890');
      
      // Verify fingerprints are hashes, not plaintext
      expect(lead!.emailFingerprint).toHaveLength(64); // SHA256 hex
      expect(lead!.phoneFingerprint).toHaveLength(64); // SHA256 hex
      expect(lead!.emailFingerprint).toMatch(/^[a-f0-9]+$/);
      expect(lead!.phoneFingerprint).toMatch(/^[a-f0-9]+$/);
    });

    it('should use different fingerprints for email and phone', () => {
      const data = 'test@example.com';
      
      const emailFingerprint = encryption.generateFingerprint(data, 'email');
      const phoneFingerprint = encryption.generateFingerprint(data, 'phone');
      
      expect(emailFingerprint).not.toBe(phoneFingerprint);
    });

    it('should normalize data before fingerprinting', () => {
      // Email normalization
      const email1 = 'Test@Example.com';
      const email2 = 'test@example.com';
      const email3 = '  test@example.com  ';
      
      const emailFp1 = encryption.generateFingerprint(email1, 'email');
      const emailFp2 = encryption.generateFingerprint(email2, 'email');
      const emailFp3 = encryption.generateFingerprint(email3, 'email');
      
      expect(emailFp1).toBe(emailFp2);
      expect(emailFp2).toBe(emailFp3);

      // Phone normalization
      const phone1 = '+1 (234) 567-8900';
      const phone2 = '12345678900';
      const phone3 = '+1-234-567-8900';
      
      const phoneFp1 = encryption.generateFingerprint(phone1, 'phone');
      const phoneFp2 = encryption.generateFingerprint(phone2, 'phone');
      const phoneFp3 = encryption.generateFingerprint(phone3, 'phone');
      
      expect(phoneFp1).toBe(phoneFp2);
      expect(phoneFp2).toBe(phoneFp3);
    });
  });
});