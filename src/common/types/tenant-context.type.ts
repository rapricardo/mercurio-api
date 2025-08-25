export interface TenantContext {
  tenantId: bigint
  workspaceId: bigint
  apiKeyId: bigint
  scopes: string[]
}

export interface ApiKeyValidationResult {
  isValid: boolean
  tenantId?: bigint
  workspaceId?: bigint
  apiKeyId?: bigint
  scopes: string[]
  revokedAt?: Date
  lastUsedAt?: Date
}

export interface TracingContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  tenantId: bigint
  workspaceId: bigint
  apiKeyId: bigint
}

export interface EventLogContext {
  traceId: string
  tenantId: bigint
  workspaceId: bigint
  eventName?: string
  anonymousId?: string
  sessionId?: string
  processingTimeMs: number
  success: boolean
  errorCode?: string
}