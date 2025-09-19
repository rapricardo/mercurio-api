export interface TenantContext {
  tenantId: bigint
  workspaceId: bigint
  apiKeyId: bigint
  scopes: string[]
}

export interface HybridTenantContext extends TenantContext {
  // API Key auth fields (existing)
  tenantId: bigint
  workspaceId: bigint
  apiKeyId: bigint
  scopes: string[]

  // Supabase auth fields (new)
  userId?: string
  userEmail?: string
  userRole?: string
  authType: 'api_key' | 'supabase_jwt'

  // Workspace access for JWT auth
  workspaceAccess?: Array<{
    tenantId: bigint
    workspaceId: bigint
    role: string
  }>
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
