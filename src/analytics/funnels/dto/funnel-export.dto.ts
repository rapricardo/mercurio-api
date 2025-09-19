import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsBoolean,
  IsEmail,
  ValidateNested,
  IsObject,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'

/**
 * Export format options
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
}

/**
 * Export type options determining data granularity
 */
export enum ExportType {
  SUMMARY = 'summary', // High-level metrics and aggregations
  DETAILED = 'detailed', // Detailed analysis with breakdowns
  RAW_EVENTS = 'raw_events', // Raw event data for further analysis
}

/**
 * Delivery method options
 */
export enum DeliveryMethod {
  DOWNLOAD = 'download', // Direct download link
  EMAIL = 'email', // Email delivery
}

/**
 * Export filters for customizing exported data
 */
export class ExportFilters {
  @IsOptional()
  @IsDateString()
  start_date?: string

  @IsOptional()
  @IsDateString()
  end_date?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segments?: string[]

  @IsOptional()
  @IsArray()
  steps?: number[]

  @IsOptional()
  @IsBoolean()
  include_cohorts?: boolean

  @IsOptional()
  @IsBoolean()
  include_attribution?: boolean

  @IsOptional()
  @IsBoolean()
  anonymize_data?: boolean
}

/**
 * Request DTO for funnel data export
 */
export class FunnelExportRequest {
  @IsEnum(ExportFormat)
  format!: ExportFormat

  @IsEnum(ExportType)
  export_type!: ExportType

  @IsEnum(DeliveryMethod)
  delivery_method!: DeliveryMethod

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportFilters)
  filters?: ExportFilters

  @IsOptional()
  @IsObject()
  options?: Record<string, any>
}

/**
 * Export status tracking
 */
export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Export job metadata
 */
export interface ExportJobMetadata {
  total_records: number
  processed_records: number
  estimated_file_size: number
  estimated_completion: string
  started_at: string
  completed_at?: string
  error_message?: string
}

/**
 * Response DTO for export request
 */
export interface FunnelExportResponse {
  export_id: string
  status: ExportStatus
  metadata: ExportJobMetadata
  download_url?: string
  download_expires_at?: string
  export_config: FunnelExportRequest
}

/**
 * Response DTO for export status check
 */
export interface ExportStatusResponse {
  export_id: string
  status: ExportStatus
  progress_percent: number
  metadata: ExportJobMetadata
  download_url?: string
  download_expires_at?: string
}

/**
 * Data structure for CSV export
 */
export interface FunnelCSVData {
  funnel_name: string
  step_order: number
  step_name: string
  unique_users: number
  conversion_rate: number
  drop_off_rate: number
  avg_time_to_complete: number
  date_range: string
  segment?: string
  [key: string]: any // Allow additional fields based on export type
}

/**
 * Data structure for JSON export
 */
export interface FunnelJSONExport {
  export_metadata: {
    funnel_id: string
    funnel_name: string
    export_type: ExportType
    generated_at: string
    date_range: {
      start: string
      end: string
    }
    total_records: number
  }
  summary: {
    total_entries: number
    total_conversions: number
    overall_conversion_rate: number
    average_time_to_convert: number
  }
  step_data: Array<{
    step_order: number
    step_name: string
    metrics: {
      unique_users: number
      conversion_rate: number
      drop_off_rate: number
      avg_time_in_step: number
    }
    segments?: Array<{
      segment_name: string
      metrics: Record<string, number>
    }>
  }>
  cohort_analysis?: Array<{
    cohort_period: string
    cohort_data: Record<string, any>
  }>
  attribution_analysis?: Array<{
    attribution_model: string
    results: Record<string, any>
  }>
}

/**
 * Integration webhook payload for export completion
 */
export interface ExportWebhookPayload {
  event: string
  export_id: string
  status: ExportStatus
  tenant_id: string
  workspace_id: string
  funnel_id: string
  download_url?: string
  error?: {
    code: string
    message: string
  }
  timestamp: string
}
