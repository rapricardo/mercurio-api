import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { FunnelConfigService } from '../services/funnel-config.service';
import { HybridAuthGuard } from '../../../common/auth/hybrid-auth.guard';
import { CurrentTenant } from '../../../common/context/tenant-context.provider';
import type { HybridTenantContext } from '../../../common/types/tenant-context.type';
import { MetricsService } from '../../../common/services/metrics.service';
import {
  CreateFunnelRequestDto,
  UpdateFunnelRequestDto,
  ListFunnelsQueryDto,
  PublishFunnelRequestDto,
} from '../dto/funnel-request.dto';
import {
  FunnelResponseDto,
  ListFunnelsResponseDto,
  CreateFunnelResponseDto,
  UpdateFunnelResponseDto,
  ArchiveFunnelResponseDto,
  PublishFunnelResponseDto,
} from '../dto/funnel-response.dto';

@Controller('v1/analytics/funnels')
@UseGuards(HybridAuthGuard)
export class FunnelConfigController {
  private readonly logger = new Logger(FunnelConfigController.name);

  constructor(
    private readonly funnelConfigService: FunnelConfigService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Record metrics for funnel configuration operations
   */
  private recordMetrics(
    operation: string,
    duration: number,
    tenantId: string,
    success: boolean = true,
  ): void {
    this.metrics.incrementCounter(`funnels.config.${operation}_requests`);
    this.metrics.recordLatency('funnels.config.operation_latency', duration);
    
    if (!success) {
      this.metrics.incrementCounter(`funnels.config.${operation}_errors`);
    }

    if (duration > 1000) {
      this.metrics.incrementCounter('funnels.config.slow_operations');
      this.logger.warn('Slow funnel configuration operation detected', {
        operation,
        duration,
        tenantId,
        threshold: 1000,
        performance_alert: true,
      });
    }
  }

  /**
   * POST /v1/analytics/funnels
   * Create a new funnel configuration
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createFunnel(
    @Body() request: CreateFunnelRequestDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<CreateFunnelResponseDto> {
    const startTime = Date.now();

    try {
      const result = await this.funnelConfigService.createFunnel(
        tenant.tenantId,
        tenant.workspaceId,
        request,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('create', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnel created successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: result.id,
        name: request.name,
        stepCount: request.steps.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('create', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to create funnel', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        name: request.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/funnels
   * List funnels with pagination and filtering
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listFunnels(
    @Query() query: ListFunnelsQueryDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<ListFunnelsResponseDto> {
    const startTime = Date.now();

    try {
      const result = await this.funnelConfigService.listFunnels(
        tenant.tenantId,
        tenant.workspaceId,
        query,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('list', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnels listed successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        page: query.page,
        limit: query.limit,
        totalCount: result.pagination.total_count,
        returnedCount: result.funnels.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('list', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to list funnels', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * GET /v1/analytics/funnels/:id
   * Get a specific funnel by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getFunnelById(
    @Param('id') id: string,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<FunnelResponseDto> {
    const startTime = Date.now();

    try {
      const result = await this.funnelConfigService.getFunnelById(
        id,
        tenant.tenantId,
        tenant.workspaceId,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('get', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnel retrieved successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        name: result.name,
        currentVersion: result.current_version,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('get', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get funnel', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * PATCH /v1/analytics/funnels/:id
   * Update an existing funnel
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateFunnel(
    @Param('id') id: string,
    @Body() request: UpdateFunnelRequestDto,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<UpdateFunnelResponseDto> {
    const startTime = Date.now();

    try {
      const result = await this.funnelConfigService.updateFunnel(
        id,
        tenant.tenantId,
        tenant.workspaceId,
        request,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('update', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnel updated successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        newVersion: result.new_version,
        hasStepChanges: !!request.steps,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('update', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to update funnel', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * DELETE /v1/analytics/funnels/:id
   * Archive a funnel (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async archiveFunnel(
    @Param('id') id: string,
    @CurrentTenant() tenant: HybridTenantContext,
  ): Promise<ArchiveFunnelResponseDto> {
    const startTime = Date.now();

    try {
      const result = await this.funnelConfigService.archiveFunnel(
        id,
        tenant.tenantId,
        tenant.workspaceId,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('archive', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnel archived successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        name: result.name,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('archive', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to archive funnel', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  /**
   * POST /v1/analytics/funnels/:id/publish
   * Publish a specific version of a funnel
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishFunnel(
    @Param('id') id: string,
    @CurrentTenant() tenant: HybridTenantContext,
    @Query('version', new ParseIntPipe({ optional: true })) version?: number,
    @Body() request: PublishFunnelRequestDto = {},
  ): Promise<PublishFunnelResponseDto> {
    const startTime = Date.now();

    try {
      // If no version specified, get the latest version
      let targetVersion = version;
      if (!targetVersion) {
        const funnel = await this.funnelConfigService.getFunnelById(
          id,
          tenant.tenantId,
          tenant.workspaceId,
        );
        targetVersion = funnel.current_version;
      }

      const result = await this.funnelConfigService.publishFunnel(
        id,
        targetVersion,
        tenant.tenantId,
        tenant.workspaceId,
        request.window_days,
        request.notes,
      );

      const duration = Date.now() - startTime;
      this.recordMetrics('publish', duration, tenant.tenantId.toString(), true);

      this.logger.log('Funnel published successfully', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        version: targetVersion,
        publicationId: result.publication_id,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetrics('publish', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to publish funnel', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        funnelId: id,
        version,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }
}