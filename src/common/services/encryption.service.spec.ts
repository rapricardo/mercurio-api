import { Test, TestingModule } from '@nestjs/testing'
import { EncryptionService } from './encryption.service'

describe('EncryptionService', () => {
  let service: EncryptionService

  beforeAll(async () => {
    // Set up test environment variables
    process.env.NODE_ENV = 'test'
    process.env.ENCRYPTION_KEK_SECRET = 'dGVzdC1rZWstc2VjcmV0LWZvci10ZXN0aW5nLW9ubHk=' // base64: "test-kek-secret-for-testing-only"
    process.env.EMAIL_DEK_SECRET = 'dGVzdC1lbWFpbC1kZWstc2VjcmV0LWZvci10ZXN0aW5n' // base64: "test-email-dek-secret-for-testing"
    process.env.PHONE_DEK_SECRET = 'dGVzdC1waG9uZS1kZWstc2VjcmV0LWZvci10ZXN0aW5n' // base64: "test-phone-dek-secret-for-testing"
    process.env.EMAIL_FINGERPRINT_SECRET = 'dGVzdC1lbWFpbC1maW5nZXJwcmludC1zZWNyZXQ=' // base64: "test-email-fingerprint-secret"
    process.env.PHONE_FINGERPRINT_SECRET = 'dGVzdC1waG9uZS1maW5nZXJwcmludC1zZWNyZXQ=' // base64: "test-phone-fingerprint-secret"
    process.env.ENCRYPTION_KEY_VERSION = '1'

    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile()

    service = module.get<EncryptionService>(EncryptionService)
  })

  afterAll(() => {
    // Clean up environment variables
    delete process.env.ENCRYPTION_KEK_SECRET
    delete process.env.EMAIL_DEK_SECRET
    delete process.env.PHONE_DEK_SECRET
    delete process.env.EMAIL_FINGERPRINT_SECRET
    delete process.env.PHONE_FINGERPRINT_SECRET
    delete process.env.ENCRYPTION_KEY_VERSION
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('Email Encryption', () => {
    it('should encrypt and decrypt email addresses correctly', async () => {
      const testEmail = 'test@example.com'

      const encrypted = await service.encryptEmail(testEmail)
      expect(encrypted).toBeDefined()
      expect(encrypted.encrypted).toBeDefined()
      expect(encrypted.fingerprint).toBeDefined()
      expect(encrypted.keyVersion).toBe(1)

      const decrypted = await service.decryptEmail(encrypted.encrypted, encrypted.keyVersion)
      expect(decrypted).toBe(testEmail)
    })

    it('should generate consistent fingerprints for same email', () => {
      const testEmail = 'test@example.com'

      const fingerprint1 = service.generateFingerprint(testEmail, 'email')
      const fingerprint2 = service.generateFingerprint(testEmail, 'email')

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint1).toHaveLength(64) // SHA256 hex length
    })

    it('should normalize email addresses for fingerprinting', () => {
      const email1 = 'Test@Example.com'
      const email2 = 'test@example.com'
      const email3 = '  test@example.com  '

      const fingerprint1 = service.generateFingerprint(email1, 'email')
      const fingerprint2 = service.generateFingerprint(email2, 'email')
      const fingerprint3 = service.generateFingerprint(email3, 'email')

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint2).toBe(fingerprint3)
    })

    it('should generate different fingerprints for different emails', () => {
      const email1 = 'test1@example.com'
      const email2 = 'test2@example.com'

      const fingerprint1 = service.generateFingerprint(email1, 'email')
      const fingerprint2 = service.generateFingerprint(email2, 'email')

      expect(fingerprint1).not.toBe(fingerprint2)
    })

    it('should generate different encrypted values for same email (due to random IV)', async () => {
      const testEmail = 'test@example.com'

      const encrypted1 = await service.encryptEmail(testEmail)
      const encrypted2 = await service.encryptEmail(testEmail)

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
      expect(encrypted1.fingerprint).toBe(encrypted2.fingerprint) // Fingerprints should be the same
    })
  })

  describe('Phone Number Encryption', () => {
    it('should encrypt and decrypt phone numbers correctly', async () => {
      const testPhone = '+1234567890'

      const encrypted = await service.encryptPhone(testPhone)
      expect(encrypted).toBeDefined()
      expect(encrypted.encrypted).toBeDefined()
      expect(encrypted.fingerprint).toBeDefined()
      expect(encrypted.keyVersion).toBe(1)

      const decrypted = await service.decryptPhone(encrypted.encrypted, encrypted.keyVersion)
      expect(decrypted).toBe(testPhone)
    })

    it('should normalize phone numbers for fingerprinting', () => {
      const phone1 = '+1 (234) 567-8900'
      const phone2 = '12345678900'
      const phone3 = '+1-234-567-8900'

      const fingerprint1 = service.generateFingerprint(phone1, 'phone')
      const fingerprint2 = service.generateFingerprint(phone2, 'phone')
      const fingerprint3 = service.generateFingerprint(phone3, 'phone')

      expect(fingerprint1).toBe(fingerprint2)
      expect(fingerprint2).toBe(fingerprint3)
    })

    it('should generate different fingerprints for different phone numbers', () => {
      const phone1 = '+1234567890'
      const phone2 = '+9876543210'

      const fingerprint1 = service.generateFingerprint(phone1, 'phone')
      const fingerprint2 = service.generateFingerprint(phone2, 'phone')

      expect(fingerprint1).not.toBe(fingerprint2)
    })
  })

  describe('Key Version Management', () => {
    it('should return current key version', () => {
      const version = service.getCurrentKeyVersion()
      expect(version).toBe(1)
    })

    it('should include key version in encrypted data', async () => {
      const testEmail = 'version@test.com'
      const encrypted = await service.encryptEmail(testEmail)

      expect(encrypted.keyVersion).toBe(1)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate configuration successfully with all secrets', () => {
      const isValid = service.validateConfiguration()
      expect(isValid).toBe(true)
    })

    it('should handle missing environment variables in development', () => {
      // This test verifies that the service can start with default keys in development
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      delete process.env.EMAIL_DEK_SECRET

      // Creating new service instance should not throw
      expect(() => new EncryptionService()).not.toThrow()

      // Restore environment
      process.env.NODE_ENV = originalEnv
      process.env.EMAIL_DEK_SECRET = 'dGVzdC1lbWFpbC1kZWstc2VjcmV0LWZvci10ZXN0aW5n'
    })
  })

  describe('Error Handling', () => {
    it('should handle encryption failures gracefully', async () => {
      // Create a service instance with invalid configuration to trigger errors
      const originalSecret = process.env.EMAIL_DEK_SECRET
      process.env.EMAIL_DEK_SECRET = ''

      const invalidService = new EncryptionService()

      await expect(invalidService.encryptEmail('test@example.com')).rejects.toThrow()

      // Restore original secret
      process.env.EMAIL_DEK_SECRET = originalSecret
    })

    it('should handle decryption failures gracefully', async () => {
      const invalidEncryptedData = 'invalid-base64-data'

      await expect(service.decryptEmail(invalidEncryptedData)).rejects.toThrow()
    })

    it('should throw error for automated key rotation', async () => {
      await expect(service.rotateKeys()).rejects.toThrow('Automated key rotation not implemented')
    })
  })

  describe('Health Check', () => {
    it('should pass health check with valid configuration', async () => {
      const isHealthy = await service.healthCheck()
      expect(isHealthy).toBe(true)
    })

    it('should fail health check with corrupted service', async () => {
      // Mock a method to fail
      const originalEncryptEmail = service.encryptEmail
      service.encryptEmail = jest.fn().mockRejectedValue(new Error('Mock failure'))

      const isHealthy = await service.healthCheck()
      expect(isHealthy).toBe(false)

      // Restore original method
      service.encryptEmail = originalEncryptEmail
    })
  })

  describe('Security Properties', () => {
    it('should use different fingerprint secrets for email and phone', () => {
      const data = 'test@example.com'

      const emailFingerprint = service.generateFingerprint(data, 'email')
      const phoneFingerprint = service.generateFingerprint(data, 'phone')

      expect(emailFingerprint).not.toBe(phoneFingerprint)
    })

    it('should generate cryptographically strong fingerprints', () => {
      const testData = 'security@test.com'
      const fingerprint = service.generateFingerprint(testData, 'email')

      // SHA256 hex should be 64 characters
      expect(fingerprint).toHaveLength(64)
      // Should only contain hex characters
      expect(fingerprint).toMatch(/^[a-f0-9]+$/)
    })

    it('should not expose secrets in logs or errors', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      try {
        await service.encryptEmail('test@example.com')
        await service.decryptEmail('invalid-data').catch(() => {}) // Expected to fail

        // Check that no log contains actual secrets
        const allLogs = [...consoleWarnSpy.mock.calls, ...consoleErrorSpy.mock.calls].flat()

        for (const log of allLogs) {
          expect(log).not.toContain(process.env.EMAIL_DEK_SECRET)
          expect(log).not.toContain(process.env.PHONE_DEK_SECRET)
          expect(log).not.toContain(process.env.EMAIL_FINGERPRINT_SECRET)
          expect(log).not.toContain(process.env.PHONE_FINGERPRINT_SECRET)
        }
      } finally {
        consoleWarnSpy.mockRestore()
        consoleErrorSpy.mockRestore()
      }
    })
  })
})
