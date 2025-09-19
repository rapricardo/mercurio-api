import { Injectable, Logger } from '@nestjs/common'
import { randomBytes, createHmac } from 'crypto'
import * as crypto from 'crypto'
import { MetricsService } from './metrics.service'

export interface EncryptedPII {
  encrypted: string
  fingerprint: string
  keyVersion: number
}

export interface EncryptionConfig {
  kekSecret: string
  emailDekSecret: string
  phoneDekSecret: string
  emailFingerprintSecret: string
  phoneFingerprintSecret: string
  currentKeyVersion: number
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name)
  private readonly algorithm = 'aes-256-gcm'
  private readonly config: EncryptionConfig

  constructor(private readonly metrics?: MetricsService) {
    this.config = {
      kekSecret: process.env.ENCRYPTION_KEK_SECRET || this.generateDefaultKey(),
      emailDekSecret: process.env.EMAIL_DEK_SECRET || this.generateDefaultKey(),
      phoneDekSecret: process.env.PHONE_DEK_SECRET || this.generateDefaultKey(),
      emailFingerprintSecret: process.env.EMAIL_FINGERPRINT_SECRET || this.generateDefaultKey(),
      phoneFingerprintSecret: process.env.PHONE_FINGERPRINT_SECRET || this.generateDefaultKey(),
      currentKeyVersion: parseInt(process.env.ENCRYPTION_KEY_VERSION || '1'),
    }

    // Warn if using default keys in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ENCRYPTION_KEK_SECRET) {
        this.logger.warn('Using default encryption KEK secret in production - THIS IS NOT SECURE')
      }
      if (!process.env.EMAIL_DEK_SECRET) {
        this.logger.warn('Using default email DEK secret in production - THIS IS NOT SECURE')
      }
      if (!process.env.PHONE_DEK_SECRET) {
        this.logger.warn('Using default phone DEK secret in production - THIS IS NOT SECURE')
      }
    }

    this.logger.log(
      `Encryption service initialized with key version ${this.config.currentKeyVersion}`
    )
  }

  /**
   * Encrypt email address using AES-256-GCM
   */
  async encryptEmail(email: string): Promise<EncryptedPII> {
    return this.encryptData(email, 'email')
  }

  /**
   * Encrypt phone number using AES-256-GCM
   */
  async encryptPhone(phone: string): Promise<EncryptedPII> {
    return this.encryptData(phone, 'phone')
  }

  /**
   * Decrypt email address
   */
  async decryptEmail(encryptedData: string, keyVersion?: number): Promise<string> {
    return this.decryptData(encryptedData, 'email', keyVersion)
  }

  /**
   * Decrypt phone number
   */
  async decryptPhone(encryptedData: string, keyVersion?: number): Promise<string> {
    return this.decryptData(encryptedData, 'phone', keyVersion)
  }

  /**
   * Generate searchable fingerprint for PII data
   */
  generateFingerprint(data: string, type: 'email' | 'phone'): string {
    const secret =
      type === 'email' ? this.config.emailFingerprintSecret : this.config.phoneFingerprintSecret

    // Normalize data before fingerprinting
    const normalizedData = type === 'email' ? data.toLowerCase().trim() : data.replace(/\D/g, '') // Remove non-digits for phone numbers

    const hmac = createHmac('sha256', secret)
    hmac.update(normalizedData)
    return hmac.digest('hex')
  }

  /**
   * Rotate encryption keys (manual procedure for Sprint 2)
   */
  async rotateKeys(): Promise<void> {
    this.logger.warn('Key rotation requested - this is a manual procedure in Sprint 2')
    this.logger.warn(
      'Please follow the key rotation runbook in docs/guidelines/security-privacy.md'
    )

    // In a future sprint, this would:
    // 1. Generate new keys
    // 2. Update key version
    // 3. Re-encrypt data with new keys
    // 4. Update environment variables

    throw new Error('Automated key rotation not implemented in Sprint 2 - use manual procedure')
  }

  /**
   * Get current key version
   */
  getCurrentKeyVersion(): number {
    return this.config.currentKeyVersion
  }

  /**
   * Validate encryption configuration
   */
  validateConfiguration(): boolean {
    const requiredSecrets = [
      'kekSecret',
      'emailDekSecret',
      'phoneDekSecret',
      'emailFingerprintSecret',
      'phoneFingerprintSecret',
    ]

    for (const secret of requiredSecrets) {
      if (
        !this.config[secret as keyof EncryptionConfig] ||
        this.config[secret as keyof EncryptionConfig] === ''
      ) {
        this.logger.error(`Missing required encryption configuration: ${secret}`)
        return false
      }
    }

    return true
  }

  /**
   * Core encryption method using AES-256-GCM
   */
  private async encryptData(data: string, type: 'email' | 'phone'): Promise<EncryptedPII> {
    const startTime = Date.now()

    try {
      // Use base64 key directly as 32-byte key
      const keyBuffer = Buffer.from(
        type === 'email' ? this.config.emailDekSecret : this.config.phoneDekSecret,
        'base64'
      )
      const key =
        keyBuffer.length >= 32
          ? keyBuffer.slice(0, 32)
          : Buffer.concat([keyBuffer, Buffer.alloc(32 - keyBuffer.length)])

      // Generate random IV for GCM (12 bytes recommended)
      const iv = randomBytes(12)

      // Create cipher with explicit IV (correct AES-GCM usage)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

      // Set Additional Authenticated Data
      cipher.setAAD(Buffer.from(`${type}:${this.config.currentKeyVersion}`))

      // Encrypt data
      const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])

      const authTag = cipher.getAuthTag()

      // Combine IV + AuthTag + Encrypted Data
      const combined = Buffer.concat([iv, authTag, encrypted]).toString('base64')

      const fingerprint = this.generateFingerprint(data, type)

      // Record metrics
      const latency = Date.now() - startTime
      this.metrics?.incrementCounter('encryption.operations')
      this.metrics?.incrementCounter(`encryption.${type}_encryptions`)
      this.metrics?.recordLatency('encryption.latency', latency)

      return {
        encrypted: combined,
        fingerprint,
        keyVersion: this.config.currentKeyVersion,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.metrics?.incrementCounter('encryption.errors')
      this.metrics?.recordLatency('encryption.latency', latency)

      this.logger.error(`Failed to encrypt ${type} data:`, error)
      throw new Error(`Encryption failed for ${type} data`)
    }
  }

  /**
   * Core decryption method using AES-256-GCM
   */
  private async decryptData(
    encryptedData: string,
    type: 'email' | 'phone',
    keyVersion?: number
  ): Promise<string> {
    const startTime = Date.now()

    try {
      // Use base64 key directly as 32-byte key
      const keyBuffer = Buffer.from(
        type === 'email' ? this.config.emailDekSecret : this.config.phoneDekSecret,
        'base64'
      )
      const key =
        keyBuffer.length >= 32
          ? keyBuffer.slice(0, 32)
          : Buffer.concat([keyBuffer, Buffer.alloc(32 - keyBuffer.length)])
      const targetKeyVersion = keyVersion || this.config.currentKeyVersion

      // Parse combined data
      const combined = Buffer.from(encryptedData, 'base64')
      const iv = combined.slice(0, 12) // 12 bytes for GCM IV
      const authTag = combined.slice(12, 28) // 16 bytes for auth tag
      const encrypted = combined.slice(28)

      // Create decipher with explicit IV (correct AES-GCM usage)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAAD(Buffer.from(`${type}:${targetKeyVersion}`))
      decipher.setAuthTag(authTag)

      // Decrypt data
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

      // Record metrics
      const latency = Date.now() - startTime
      this.metrics?.incrementCounter('encryption.operations')
      this.metrics?.incrementCounter(`encryption.${type}_decryptions`)
      this.metrics?.recordLatency('encryption.latency', latency)

      return decrypted.toString('utf8')
    } catch (error) {
      const latency = Date.now() - startTime
      this.metrics?.incrementCounter('encryption.errors')
      this.metrics?.recordLatency('encryption.latency', latency)

      this.logger.error(`Failed to decrypt ${type} data:`, error)
      throw new Error(`Decryption failed for ${type} data`)
    }
  }

  /**
   * Generate a default key for development/testing
   */
  private generateDefaultKey(): string {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot generate default encryption keys in production environment')
    }

    const key = randomBytes(32).toString('base64')
    this.logger.warn(
      `Generated default encryption key: ${key.substring(0, 8)}... (development only)`
    )
    return key
  }

  /**
   * Health check for encryption service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test encrypt/decrypt cycle
      const testData = 'test@example.com'
      const encrypted = await this.encryptEmail(testData)
      const decrypted = await this.decryptEmail(encrypted.encrypted, encrypted.keyVersion)

      if (decrypted !== testData) {
        this.logger.error('Encryption health check failed: decrypt result mismatch')
        return false
      }

      // Test fingerprint generation
      const fingerprint = this.generateFingerprint(testData, 'email')
      if (!fingerprint || fingerprint.length !== 64) {
        // SHA256 hex = 64 chars
        this.logger.error('Encryption health check failed: invalid fingerprint')
        return false
      }

      return true
    } catch (error) {
      this.logger.error('Encryption health check failed:', error)
      return false
    }
  }
}
