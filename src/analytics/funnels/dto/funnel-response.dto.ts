import { FunnelStepType, MatchingRuleKind, FunnelVersionState } from './funnel-request.dto'

// Base matching rule response
export interface MatchingRuleResponseDto {
  kind: MatchingRuleKind
  rules: Record<string, any>
}

// Funnel step response
export interface FunnelStepResponseDto {
  id: string
  order: number
  type: FunnelStepType
  label: string
  matching_rules: MatchingRuleResponseDto[]
  metadata?: Record<string, any>
}

// Funnel version response
export interface FunnelVersionResponseDto {
  id: string
  version: number
  state: FunnelVersionState
  created_at: string
  steps: FunnelStepResponseDto[]
}

// Funnel publication response
export interface FunnelPublicationResponseDto {
  id: string
  version: number
  published_at: string
  window_days: number
  notes?: string
}

// Single funnel response
export interface FunnelResponseDto {
  id: string
  name: string
  description?: string
  created_at: string
  archived_at?: string
  versions: FunnelVersionResponseDto[]
  publications: FunnelPublicationResponseDto[]
  current_version: number
  current_state: FunnelVersionState
  published_version?: number
  step_count: number
}

// Pagination metadata
export interface PaginationMetadata {
  page: number
  limit: number
  total_count: number
  total_pages: number
  has_next_page: boolean
  has_previous_page: boolean
}

// List funnels response
export interface ListFunnelsResponseDto {
  funnels: FunnelResponseDto[]
  pagination: PaginationMetadata
  filters: {
    search?: string
    state?: FunnelVersionState
    include_archived: boolean
  }
  summary: {
    total_funnels: number
    draft_funnels: number
    published_funnels: number
    archived_funnels: number
  }
}

// Create funnel response
export interface CreateFunnelResponseDto {
  id: string
  name: string
  description?: string
  created_at: string
  version_id: string
  version: number
  state: FunnelVersionState
  step_count: number
  message: string
}

// Update funnel response
export interface UpdateFunnelResponseDto {
  id: string
  name: string
  description?: string
  updated_at: string
  new_version_id: string
  new_version: number
  state: FunnelVersionState
  step_count: number
  message: string
}

// Archive funnel response
export interface ArchiveFunnelResponseDto {
  id: string
  name: string
  archived_at: string
  message: string
}

// Publish funnel response
export interface PublishFunnelResponseDto {
  funnel_id: string
  publication_id: string
  version: number
  published_at: string
  window_days: number
  notes?: string
  message: string
}

// Error response DTO
export interface FunnelErrorResponseDto {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
  path: string
}
