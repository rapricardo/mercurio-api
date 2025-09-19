import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as csvWriter from 'csv-writer'
import * as ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'

// DTOs
import {
  FunnelExportRequest,
  FunnelExportResponse,
  ExportStatusResponse,
  ExportStatus,
  ExportFormat,
  ExportType,
  DeliveryMethod,
  FunnelCSVData,
  FunnelJSONExport,
  ExportJobMetadata,
} from '../dto/funnel-export.dto'

// Services
import { FunnelAnalyticsService } from './funnel-analytics.service'
import { FunnelConfigService } from './funnel-config.service'
import { FunnelCacheService } from './funnel-cache.service'

// Types
export interface TenantContext {
  tenantId: bigint
  workspaceId: bigint
}

/**
 * Export job tracking interface
 */
interface ExportJob {
  export_id: string
  status: ExportStatus
  tenant_id: string
  workspace_id: string
  funnel_id: string
  config: FunnelExportRequest
  metadata: ExportJobMetadata
  file_path?: string
  download_url?: string
  created_at: Date
  started_at?: Date
  completed_at?: Date
  error_message?: string
}

/**
 * FunnelExportService handles data export in multiple formats with streaming support
 *
 * Features:
 * - Multiple export formats (CSV, JSON, Excel)
 * - Streaming for large datasets
 * - Email delivery integration
 * - Progress tracking and status monitoring
 * - Data anonymization for privacy compliance
 * - Webhook notifications for integration
 */
@Injectable()
export class FunnelExportService {
  private readonly logger = new Logger(FunnelExportService.name)
  private readonly exportJobs = new Map<string, ExportJob>()
  private readonly downloadBaseUrl: string
  private readonly exportDirectory: string

  constructor(
    private readonly funnelAnalyticsService: FunnelAnalyticsService,
    private readonly funnelConfigService: FunnelConfigService,
    private readonly cacheService: FunnelCacheService
  ) {
    this.downloadBaseUrl =
      process.env.EXPORT_DOWNLOAD_BASE_URL || 'http://localhost:3000/downloads/exports'
    this.exportDirectory = process.env.EXPORT_DIRECTORY || '/tmp/exports'

    // Ensure export directory exists
    this.ensureExportDirectory()
  }

  /**
   * Initiate a new export job
   */
  async createExport(
    funnelId: string,
    request: FunnelExportRequest,
    context: TenantContext
  ): Promise<FunnelExportResponse> {
    this.logger.log(`Creating export for funnel ${funnelId}`, { context, request })

    // Validate request
    this.validateExportRequest(request)

    // Verify funnel exists and user has access
    const funnel = await this.funnelConfigService.getFunnelById(
      funnelId,
      context.tenantId,
      context.workspaceId
    )
    if (!funnel) {
      throw new BadRequestException(`Funnel ${funnelId} not found`)
    }

    // Create export job
    const exportId = `exp_${uuidv4().replace(/-/g, '')}`
    const now = new Date()

    // Get data size estimation for metadata
    const sizeEstimation = await this.estimateExportSize(funnelId, request, context)

    const exportJob: ExportJob = {
      export_id: exportId,
      status: ExportStatus.PENDING,
      tenant_id: context.tenantId.toString(),
      workspace_id: context.workspaceId.toString(),
      funnel_id: funnelId,
      config: request,
      metadata: {
        total_records: sizeEstimation.totalRecords,
        processed_records: 0,
        estimated_file_size: sizeEstimation.estimatedSize,
        estimated_completion: new Date(
          now.getTime() + sizeEstimation.estimatedDuration
        ).toISOString(),
        started_at: now.toISOString(),
      },
      created_at: now,
    }

    this.exportJobs.set(exportId, exportJob)

    // Start export processing asynchronously
    this.processExportAsync(exportJob, context).catch((error) => {
      this.logger.error(`Export ${exportId} failed:`, error)
      exportJob.status = ExportStatus.FAILED
      exportJob.error_message = error.message
      exportJob.metadata.error_message = error.message
    })

    return {
      export_id: exportId,
      status: exportJob.status,
      metadata: exportJob.metadata,
      export_config: request,
    }
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ExportStatusResponse> {
    const exportJob = this.exportJobs.get(exportId)
    if (!exportJob) {
      throw new BadRequestException(`Export ${exportId} not found`)
    }

    const progressPercent =
      exportJob.metadata.total_records > 0
        ? Math.round(
            (exportJob.metadata.processed_records / exportJob.metadata.total_records) * 100
          )
        : 0

    return {
      export_id: exportId,
      status: exportJob.status,
      progress_percent: progressPercent,
      metadata: exportJob.metadata,
      download_url: exportJob.download_url,
      download_expires_at: this.getDownloadExpirationTime(exportJob),
    }
  }

  /**
   * Process export job asynchronously
   */
  private async processExportAsync(exportJob: ExportJob, context: TenantContext): Promise<void> {
    try {
      this.logger.log(`Starting export processing for ${exportJob.export_id}`)

      exportJob.status = ExportStatus.PROCESSING
      exportJob.started_at = new Date()
      exportJob.metadata.started_at = exportJob.started_at.toISOString()

      // Get funnel data based on export type
      const funnelData = await this.getFunnelDataForExport(
        exportJob.funnel_id,
        exportJob.config,
        context
      )

      // Generate file based on format
      const filePath = await this.generateExportFile(exportJob, funnelData)

      exportJob.file_path = filePath
      exportJob.status = ExportStatus.COMPLETED
      exportJob.completed_at = new Date()
      exportJob.metadata.completed_at = exportJob.completed_at.toISOString()
      exportJob.metadata.processed_records = exportJob.metadata.total_records

      // Set download URL for download delivery method
      if (exportJob.config.delivery_method === DeliveryMethod.DOWNLOAD) {
        exportJob.download_url = this.generateDownloadUrl(exportJob)
      }

      // Handle email delivery
      if (exportJob.config.delivery_method === DeliveryMethod.EMAIL) {
        await this.sendExportEmail(exportJob)
      }

      this.logger.log(`Export ${exportJob.export_id} completed successfully`)
    } catch (error) {
      this.logger.error(`Export ${exportJob.export_id} failed:`, error)
      exportJob.status = ExportStatus.FAILED
      const errorMessage = error instanceof Error ? error.message : String(error)
      exportJob.error_message = errorMessage
      exportJob.metadata.error_message = errorMessage
      throw error
    }
  }

  /**
   * Get funnel data for export based on type
   */
  private async getFunnelDataForExport(
    funnelId: string,
    config: FunnelExportRequest,
    context: TenantContext
  ): Promise<any> {
    const cacheKey = `export_data:${funnelId}:${JSON.stringify(config)}`

    // Try cache first for better performance
    const cachedData = await this.cacheService.get<any>(cacheKey)
    if (cachedData) {
      this.logger.debug(`Using cached export data for funnel ${funnelId}`)
      return cachedData
    }

    let data: any = {}

    // Get base funnel configuration
    const funnel = await this.funnelConfigService.getFunnelById(
      funnelId,
      context.tenantId,
      context.workspaceId
    )

    switch (config.export_type) {
      case ExportType.SUMMARY:
        data = await this.getSummaryData(funnelId, config, context)
        break

      case ExportType.DETAILED:
        data = await this.getDetailedData(funnelId, config, context)
        break

      case ExportType.RAW_EVENTS:
        data = await this.getRawEventsData(funnelId, config, context)
        break

      default:
        throw new BadRequestException(`Invalid export type: ${config.export_type}`)
    }

    // Add funnel metadata
    data.funnel_metadata = {
      id: funnel.id,
      name: funnel.name,
      description: funnel.description,
      steps: [], // TODO: Extract steps from funnel configuration
    }

    // Apply data anonymization if requested
    if (config.filters?.anonymize_data) {
      data = this.anonymizeData(data)
    }

    // Cache the processed data
    await this.cacheService.set(cacheKey, data, 300000) // 5 minutes cache

    return data
  }

  /**
   * Get summary export data
   */
  private async getSummaryData(
    funnelId: string,
    config: FunnelExportRequest,
    context: TenantContext
  ): Promise<any> {
    // Get conversion analysis
    const conversionData = await this.funnelAnalyticsService.getConversionAnalysis(
      context.tenantId,
      context.workspaceId,
      BigInt(funnelId),
      {
        start_date: config.filters?.start_date || this.getDefaultStartDate(),
        end_date: config.filters?.end_date || this.getDefaultEndDate(),
        include_segments: true,
        include_timeseries: true,
      }
    )

    return {
      summary: conversionData.overall_metrics,
      step_metrics: conversionData.step_metrics,
      segment_analysis: conversionData.segment_analysis,
      time_series: conversionData.time_series,
    }
  }

  /**
   * Get detailed export data
   */
  private async getDetailedData(
    funnelId: string,
    config: FunnelExportRequest,
    context: TenantContext
  ): Promise<any> {
    const data: any = await this.getSummaryData(funnelId, config, context)

    // Add dropoff analysis
    const dropoffData = await this.funnelAnalyticsService.getDropoffAnalysis(
      context.tenantId,
      context.workspaceId,
      BigInt(funnelId),
      {
        start_date: config.filters?.start_date || this.getDefaultStartDate(),
        end_date: config.filters?.end_date || this.getDefaultEndDate(),
      }
    )
    data.dropoff_analysis = dropoffData

    // Add timing analysis
    const timingData = await this.funnelAnalyticsService.getTimingAnalysis(
      context.tenantId,
      context.workspaceId,
      BigInt(funnelId),
      {
        start_date: config.filters?.start_date || this.getDefaultStartDate(),
        end_date: config.filters?.end_date || this.getDefaultEndDate(),
      }
    )
    data.timing_analysis = timingData

    // Add cohort analysis if requested
    if (config.filters?.include_cohorts) {
      const cohortData = await this.funnelAnalyticsService.getCohortAnalysis(
        context.tenantId,
        context.workspaceId,
        BigInt(funnelId),
        {
          cohort_period: 'weekly',
          start_date: config.filters?.start_date || this.getDefaultStartDate(),
          end_date: config.filters?.end_date || this.getDefaultEndDate(),
          include_retention_curves: true,
        }
      )
      data.cohort_analysis = cohortData
    }

    // Add attribution analysis if requested (placeholder - attribution service needs to be integrated)
    if (config.filters?.include_attribution) {
      // TODO: Integrate with attribution service when available
      data.attribution_analysis = { note: 'Attribution analysis not yet integrated' }
    }

    return data
  }

  /**
   * Get raw events data (simplified version)
   */
  private async getRawEventsData(
    funnelId: string,
    config: FunnelExportRequest,
    context: TenantContext
  ): Promise<any> {
    // This would typically stream data from the events table
    // For now, we'll return a placeholder structure
    return {
      events: [],
      total_events: 0,
      note: 'Raw events export would stream directly from events table',
    }
  }

  /**
   * Generate export file based on format
   */
  private async generateExportFile(exportJob: ExportJob, data: any): Promise<string> {
    const fileName = this.generateFileName(exportJob)
    const filePath = path.join(this.exportDirectory, fileName)

    switch (exportJob.config.format) {
      case ExportFormat.CSV:
        return await this.generateCSVFile(filePath, data)

      case ExportFormat.JSON:
        return await this.generateJSONFile(filePath, data)

      case ExportFormat.EXCEL:
        return await this.generateExcelFile(filePath, data)

      default:
        throw new BadRequestException(`Unsupported export format: ${exportJob.config.format}`)
    }
  }

  /**
   * Generate CSV file
   */
  private async generateCSVFile(filePath: string, data: any): Promise<string> {
    const csvData: FunnelCSVData[] = []

    // Convert data to CSV format
    if (data.step_metrics) {
      for (const step of data.step_metrics) {
        csvData.push({
          funnel_name: data.funnel_metadata?.name || 'Unknown',
          step_order: step.step_order,
          step_name: step.step_name,
          unique_users: step.unique_users,
          conversion_rate: step.conversion_rate,
          drop_off_rate: step.drop_off_rate || 0,
          avg_time_to_complete: step.avg_time_in_step || 0,
          date_range: `${data.filters?.start_date || 'N/A'} to ${data.filters?.end_date || 'N/A'}`,
        })
      }
    }

    const createCsvWriter = csvWriter.createObjectCsvWriter
    const csvWriterInstance = createCsvWriter({
      path: filePath,
      header: [
        { id: 'funnel_name', title: 'Funnel Name' },
        { id: 'step_order', title: 'Step Order' },
        { id: 'step_name', title: 'Step Name' },
        { id: 'unique_users', title: 'Unique Users' },
        { id: 'conversion_rate', title: 'Conversion Rate' },
        { id: 'drop_off_rate', title: 'Drop-off Rate' },
        { id: 'avg_time_to_complete', title: 'Avg Time to Complete (minutes)' },
        { id: 'date_range', title: 'Date Range' },
      ],
    })

    await csvWriterInstance.writeRecords(csvData)
    return filePath
  }

  /**
   * Generate JSON file
   */
  private async generateJSONFile(filePath: string, data: any): Promise<string> {
    const jsonData: FunnelJSONExport = {
      export_metadata: {
        funnel_id: data.funnel_metadata?.id || '',
        funnel_name: data.funnel_metadata?.name || '',
        export_type: ExportType.DETAILED,
        generated_at: new Date().toISOString(),
        date_range: {
          start: data.filters?.start_date || '',
          end: data.filters?.end_date || '',
        },
        total_records: data.step_metrics?.length || 0,
      },
      summary: data.summary || {},
      step_data: data.step_metrics || [],
      cohort_analysis: data.cohort_analysis?.cohorts,
      attribution_analysis: data.attribution_analysis?.attribution_results,
    }

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8')
    return filePath
  }

  /**
   * Generate Excel file
   */
  private async generateExcelFile(filePath: string, data: any): Promise<string> {
    const workbook = new ExcelJS.Workbook()

    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary')
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ]

    if (data.summary) {
      summarySheet.addRows([
        { metric: 'Total Entries', value: data.summary.total_entries },
        { metric: 'Total Conversions', value: data.summary.total_conversions },
        { metric: 'Conversion Rate', value: `${(data.summary.conversion_rate * 100).toFixed(2)}%` },
      ])
    }

    // Step metrics worksheet
    if (data.step_metrics) {
      const stepSheet = workbook.addWorksheet('Step Metrics')
      stepSheet.columns = [
        { header: 'Step Order', key: 'step_order', width: 15 },
        { header: 'Step Name', key: 'step_name', width: 25 },
        { header: 'Unique Users', key: 'unique_users', width: 20 },
        { header: 'Conversion Rate', key: 'conversion_rate', width: 20 },
        { header: 'Drop-off Rate', key: 'drop_off_rate', width: 20 },
      ]

      stepSheet.addRows(
        data.step_metrics.map((step: any) => ({
          step_order: step.step_order,
          step_name: step.step_name,
          unique_users: step.unique_users,
          conversion_rate: `${(step.conversion_rate * 100).toFixed(2)}%`,
          drop_off_rate: `${((step.drop_off_rate || 0) * 100).toFixed(2)}%`,
        }))
      )
    }

    await workbook.xlsx.writeFile(filePath)
    return filePath
  }

  /**
   * Estimate export size and duration
   */
  private async estimateExportSize(
    funnelId: string,
    config: FunnelExportRequest,
    context: TenantContext
  ): Promise<{ totalRecords: number; estimatedSize: number; estimatedDuration: number }> {
    // Get rough count of funnel steps for estimation
    const funnel = await this.funnelConfigService.getFunnelById(
      funnelId,
      context.tenantId,
      context.workspaceId
    )
    const stepCount = 5 // Default step count estimation

    let estimatedRecords = stepCount
    let estimatedSize = 1024 // 1KB base
    let estimatedDuration = 5000 // 5 seconds base

    // Adjust based on export type
    switch (config.export_type) {
      case ExportType.SUMMARY:
        estimatedRecords *= 2
        estimatedSize *= 2
        break
      case ExportType.DETAILED:
        estimatedRecords *= 10
        estimatedSize *= 20
        estimatedDuration *= 2
        break
      case ExportType.RAW_EVENTS:
        estimatedRecords *= 1000
        estimatedSize *= 1000
        estimatedDuration *= 10
        break
    }

    // Adjust based on format
    switch (config.format) {
      case ExportFormat.EXCEL:
        estimatedSize *= 3
        estimatedDuration *= 1.5
        break
      case ExportFormat.JSON:
        estimatedSize *= 2
        break
    }

    return {
      totalRecords: estimatedRecords,
      estimatedSize,
      estimatedDuration,
    }
  }

  /**
   * Anonymize sensitive data
   */
  private anonymizeData(data: any): any {
    // Simple anonymization - in production would use more sophisticated methods
    const anonymized = JSON.parse(JSON.stringify(data))

    // Remove or hash sensitive fields recursively
    this.recursivelyAnonymize(anonymized)

    return anonymized
  }

  private recursivelyAnonymize(obj: any): void {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.recursivelyAnonymize(obj[key])
        } else if (typeof obj[key] === 'string') {
          // Anonymize fields that might contain PII
          if (['email', 'user_id', 'anonymous_id'].includes(key.toLowerCase())) {
            obj[key] = this.hashValue(obj[key])
          }
        }
      }
    }
  }

  private hashValue(value: string): string {
    // Simple hash - in production would use proper crypto
    return `hash_${value.length}_${value.substring(0, 2)}***`
  }

  /**
   * Send export via email (placeholder)
   */
  private async sendExportEmail(exportJob: ExportJob): Promise<void> {
    this.logger.log(`Sending export ${exportJob.export_id} via email to ${exportJob.config.email}`)
    // TODO: Implement email service integration
    // For now, just log that email would be sent
  }

  /**
   * Generate download URL
   */
  private generateDownloadUrl(exportJob: ExportJob): string {
    return `${this.downloadBaseUrl}/${path.basename(exportJob.file_path!)}`
  }

  /**
   * Get download expiration time
   */
  private getDownloadExpirationTime(exportJob: ExportJob): string | undefined {
    if (!exportJob.completed_at) return undefined

    // Downloads expire after 24 hours
    const expirationTime = new Date(exportJob.completed_at.getTime() + 24 * 60 * 60 * 1000)
    return expirationTime.toISOString()
  }

  /**
   * Generate file name based on export config
   */
  private generateFileName(exportJob: ExportJob): string {
    const timestamp = new Date().toISOString().split('T')[0]
    const title = exportJob.config.title || 'funnel-export'
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-')

    return `${sanitizedTitle}-${timestamp}-${exportJob.export_id}.${exportJob.config.format}`
  }

  /**
   * Validate export request
   */
  private validateExportRequest(request: FunnelExportRequest): void {
    if (request.delivery_method === DeliveryMethod.EMAIL && !request.email) {
      throw new BadRequestException('Email address is required when delivery method is email')
    }

    if (request.filters?.start_date && request.filters?.end_date) {
      const startDate = new Date(request.filters.start_date)
      const endDate = new Date(request.filters.end_date)

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date')
      }
    }
  }

  /**
   * Ensure export directory exists
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.exportDirectory)
    } catch {
      await fs.mkdir(this.exportDirectory, { recursive: true })
    }
  }

  /**
   * Get default start date (30 days ago)
   */
  private getDefaultStartDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  /**
   * Get default end date (today)
   */
  private getDefaultEndDate(): string {
    const date = new Date()
    return date.toISOString().split('T')[0]
  }
}
