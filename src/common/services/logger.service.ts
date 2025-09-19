import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common'

export interface LogContext {
  requestId?: string
  tenantId?: string
  workspaceId?: string
  userId?: string
  apiKeyId?: string
  eventId?: string
  sessionId?: string
  [key: string]: any
}

export interface StructuredLogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  context?: LogContext
  meta?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
}

@Injectable()
export class MercurioLogger implements NestLoggerService {
  private readonly isDevelopment = process.env.NODE_ENV === 'development'
  private readonly logLevel = process.env.LOG_LEVEL || 'info'

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug']
    return levels.indexOf(level) <= levels.indexOf(this.logLevel)
  }

  private formatLog(
    level: StructuredLogEntry['level'],
    message: string,
    context?: LogContext,
    meta?: Record<string, any>,
    error?: Error
  ): string {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(meta && { meta }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          code: (error as any).code,
        },
      }),
    }

    if (this.isDevelopment) {
      // Pretty print for development
      const contextStr = context
        ? ` [${context.tenantId || 'no-tenant'}:${context.requestId || 'no-req'}]`
        : ''
      return `${entry.timestamp} ${level.toUpperCase()}${contextStr} ${message}${error ? ` - ${error.message}` : ''}`
    }

    // JSON for production
    return JSON.stringify(entry)
  }

  log(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context, meta))
    }
  }

  error(message: string, error?: Error, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context, meta, error))
    }
  }

  warn(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context, meta))
    }
  }

  debug(message: string, context?: LogContext, meta?: Record<string, any>) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context, meta))
    }
  }

  // Specific business event logging
  logEventIngestion(
    eventName: string,
    context: LogContext,
    meta: {
      eventId?: string
      payloadSize: number
      processingTimeMs: number
      isDuplicate?: boolean
    }
  ) {
    this.log(`Event ingested: ${eventName}`, context, {
      category: 'event_ingestion',
      ...meta,
    })
  }

  logApiKeyUsage(
    apiKeyId: string,
    context: LogContext,
    meta: {
      endpoint: string
      method: string
      statusCode: number
      responseTimeMs: number
    }
  ) {
    this.log(
      'API key used',
      { ...context, apiKeyId },
      {
        category: 'api_key_usage',
        ...meta,
      }
    )
  }

  logTenantProvisioning(tenantId: string, workspaceId: string, context: LogContext) {
    this.log(
      'Tenant provisioned',
      { ...context, tenantId, workspaceId },
      {
        category: 'tenant_provisioning',
      }
    )
  }

  logRateLimitHit(
    tenantId: string,
    context: LogContext,
    meta: {
      limit: number
      current: number
      windowMs: number
    }
  ) {
    this.warn(
      'Rate limit hit',
      { ...context, tenantId },
      {
        category: 'rate_limiting',
        ...meta,
      }
    )
  }

  logSchemaVersionUsage(
    version: string,
    context: LogContext,
    meta: {
      isValid: boolean
      fallbackUsed?: boolean
    }
  ) {
    const message = meta.isValid ? 'Schema version used' : 'Invalid schema version, using fallback'
    this.log(message, context, {
      category: 'schema_versioning',
      version,
      ...meta,
    })
  }

  logDeduplication(
    eventId: string,
    context: LogContext,
    meta: {
      isDuplicate: boolean
      existingEventId?: string
    }
  ) {
    const message = meta.isDuplicate ? 'Duplicate event detected' : 'New event processed'
    this.log(
      message,
      { ...context, eventId },
      {
        category: 'event_deduplication',
        ...meta,
      }
    )
  }
}
