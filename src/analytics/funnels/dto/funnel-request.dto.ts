import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  IsNotEmpty,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'

// Enums for funnel configuration
export enum FunnelStepType {
  START = 'start',
  PAGE = 'page',
  EVENT = 'event',
  DECISION = 'decision',
  CONVERSION = 'conversion',
}

export enum MatchingRuleKind {
  PAGE = 'page',
  EVENT = 'event',
}

export enum FunnelVersionState {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

// Matching rule DTOs
export interface MatchingRuleDto {
  kind: MatchingRuleKind
  rules: Record<string, any>
}

// Funnel step configuration DTO
export interface FunnelStepConfigDto {
  order: number
  type: FunnelStepType
  label: string
  matching_rules: MatchingRuleDto[]
  metadata?: Record<string, any>
}

// Create funnel request DTO
export interface CreateFunnelRequestDto {
  name: string
  description?: string
  time_window_days: number
  steps: FunnelStepConfigDto[]
}

// Update funnel request DTO
export interface UpdateFunnelRequestDto {
  name?: string
  description?: string
  time_window_days?: number
  steps?: FunnelStepConfigDto[]
}

// List funnels query DTO
export interface ListFunnelsQueryDto {
  page?: number
  limit?: number
  search?: string
  state?: FunnelVersionState
  include_archived?: boolean
}

// Publish funnel request DTO
export interface PublishFunnelRequestDto {
  window_days?: number
  notes?: string
}
