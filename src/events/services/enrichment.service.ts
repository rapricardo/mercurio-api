import { Injectable, Logger } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  os: {
    name: string
    version?: string
  }
  browser: {
    name: string
    version?: string
  }
}

export interface GeoInfo {
  country?: string
  region?: string
  city?: string
  timezone?: string
}

export interface EnrichmentResult {
  device?: DeviceInfo
  geo?: GeoInfo
  userAgent?: string
  ipAddress?: string
  ingestedAt: Date
  schemaVersion: string
}

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name)
  private readonly DEFAULT_SCHEMA_VERSION = '1.0'

  enrichEvent(request: FastifyRequest): EnrichmentResult {
    const userAgent = request.headers['user-agent']
    const ipAddress = this.extractClientIP(request)

    return {
      device: this.parseUserAgent(userAgent),
      geo: this.parseGeoFromIP(ipAddress),
      userAgent,
      ipAddress,
      ingestedAt: new Date(),
      schemaVersion: this.extractSchemaVersion(request),
    }
  }

  private extractClientIP(request: FastifyRequest): string | undefined {
    // Try various headers in order of preference
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-forwarded',
      'forwarded-for',
      'forwarded',
    ]

    for (const header of headers) {
      const value = request.headers[header]
      if (value && typeof value === 'string') {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ip = value.split(',')[0].trim()
        if (this.isValidIP(ip)) {
          return ip
        }
      }
    }

    // Fallback to connection remote address (Fastify raw request)
    return request.raw?.connection?.remoteAddress || request.raw?.socket?.remoteAddress
  }

  private isValidIP(ip: string): boolean {
    // Basic IP validation (both IPv4 and IPv6)
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    
    // Skip private/local IPs for security
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return false
    }
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  private parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return {
        type: 'unknown',
        os: { name: 'unknown' },
        browser: { name: 'unknown' },
      }
    }

    const ua = userAgent.toLowerCase()

    // Detect device type
    let deviceType: DeviceInfo['type'] = 'desktop'
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      deviceType = 'mobile'
    } else if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet'
    }

    // Detect OS
    let osName = 'unknown'
    let osVersion: string | undefined

    if (ua.includes('windows')) {
      osName = 'Windows'
      const match = ua.match(/windows nt ([\d.]+)/)
      if (match) osVersion = match[1]
    } else if (ua.includes('mac os x')) {
      osName = 'macOS'
      const match = ua.match(/mac os x ([\d_]+)/)
      if (match) osVersion = match[1].replace(/_/g, '.')
    } else if (ua.includes('linux')) {
      osName = 'Linux'
    } else if (ua.includes('android')) {
      osName = 'Android'
      const match = ua.match(/android ([\d.]+)/)
      if (match) osVersion = match[1]
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      osName = 'iOS'
      const match = ua.match(/os ([\d_]+)/)
      if (match) osVersion = match[1].replace(/_/g, '.')
    }

    // Detect browser
    let browserName = 'unknown'
    let browserVersion: string | undefined

    if (ua.includes('chrome') && !ua.includes('edg')) {
      browserName = 'Chrome'
      const match = ua.match(/chrome\/([\d.]+)/)
      if (match) browserVersion = match[1]
    } else if (ua.includes('firefox')) {
      browserName = 'Firefox'
      const match = ua.match(/firefox\/([\d.]+)/)
      if (match) browserVersion = match[1]
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browserName = 'Safari'
      const match = ua.match(/version\/([\d.]+)/)
      if (match) browserVersion = match[1]
    } else if (ua.includes('edg')) {
      browserName = 'Edge'
      const match = ua.match(/edg\/([\d.]+)/)
      if (match) browserVersion = match[1]
    } else if (ua.includes('opera') || ua.includes('opr')) {
      browserName = 'Opera'
      const match = ua.match(/(?:opera|opr)\/([\d.]+)/)
      if (match) browserVersion = match[1]
    }

    return {
      type: deviceType,
      os: {
        name: osName,
        version: osVersion,
      },
      browser: {
        name: browserName,
        version: browserVersion,
      },
    }
  }

  private parseGeoFromIP(ipAddress?: string): GeoInfo {
    // Geo data is now provided by client - no automatic enrichment
    // This allows clients to control their own geo data
    // Future enhancement: could optionally integrate with MaxMind GeoIP or similar
    return {}
  }

  /**
   * Extract schema version from X-Event-Schema-Version header
   */
  private extractSchemaVersion(request: FastifyRequest): string {
    const headerVersion = request.headers['x-event-schema-version'] as string;
    
    if (headerVersion) {
      // Basic semver validation
      if (this.isValidSemver(headerVersion)) {
        return headerVersion;
      } else {
        // Log invalid version for monitoring
        this.logger.warn(`[Schema] Invalid version format: ${headerVersion}`);
      }
    }
    
    return this.DEFAULT_SCHEMA_VERSION; // Default fallback
  }

  /**
   * Validate if version string follows semver pattern
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
    return semverRegex.test(version);
  }

  /**
   * Validate event timestamp is within acceptable range
   */
  validateTimestamp(timestamp: string): { isValid: boolean; error?: string } {
    try {
      const eventTime = new Date(timestamp)
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (eventTime < fiveMinutesAgo) {
        return {
          isValid: false,
          error: 'Event timestamp is too far in the past (max 5 minutes)',
        }
      }

      if (eventTime > fiveMinutesFromNow) {
        return {
          isValid: false,
          error: 'Event timestamp is too far in the future (max 5 minutes)',
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid timestamp format',
      }
    }
  }
}