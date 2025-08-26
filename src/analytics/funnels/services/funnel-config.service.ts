import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { FunnelRepository, CreateFunnelData, UpdateFunnelData, ListFunnelsOptions } from '../repositories/funnel.repository';
import { FunnelCacheService } from './funnel-cache.service';
import { CreateFunnelRequestDto, UpdateFunnelRequestDto, ListFunnelsQueryDto } from '../dto/funnel-request.dto';
import {
  FunnelResponseDto,
  ListFunnelsResponseDto,
  CreateFunnelResponseDto,
  UpdateFunnelResponseDto,
  ArchiveFunnelResponseDto,
  PublishFunnelResponseDto,
  PaginationMetadata,
} from '../dto/funnel-response.dto';
import { FunnelVersionState } from '../dto/funnel-request.dto';

/**
 * Service for managing funnel configuration operations
 * Handles CRUD operations, caching, and data transformation
 */
@Injectable()
export class FunnelConfigService {
  private readonly logger = new Logger(FunnelConfigService.name);

  constructor(
    private readonly funnelRepository: FunnelRepository,
    private readonly funnelCache: FunnelCacheService,
  ) {}

  /**
   * Create a new funnel
   */
  async createFunnel(
    tenantId: bigint,
    workspaceId: bigint,
    request: CreateFunnelRequestDto,
  ): Promise<CreateFunnelResponseDto> {
    this.logger.log('Creating new funnel', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      name: request.name,
      stepCount: request.steps.length,
    });

    // Validate step ordering
    this.validateStepOrdering(request.steps);

    // Transform request to repository format
    const createData: CreateFunnelData = {
      name: request.name,
      description: request.description,
      tenantId,
      workspaceId,
      timeWindowDays: request.time_window_days,
      steps: request.steps.map(step => ({
        order: step.order,
        type: step.type,
        label: step.label,
        metadata: step.metadata,
        matchingRules: step.matching_rules.map(rule => ({
          kind: rule.kind,
          rules: rule.rules,
        })),
      })),
    };

    try {
      const funnel = await this.funnelRepository.createFunnel(createData);

      // Cache the new funnel configuration
      await this.funnelCache.cacheFunnelConfig(
        funnel.id.toString(),
        tenantId.toString(),
        workspaceId.toString(),
        this.transformFunnelToResponse(funnel),
      );

      // Invalidate list caches
      await this.funnelCache.invalidateWorkspaceCache(
        tenantId.toString(),
        workspaceId.toString(),
      );

      const response: CreateFunnelResponseDto = {
        id: funnel.id.toString(),
        name: funnel.name,
        description: funnel.description || undefined,
        created_at: funnel.createdAt.toISOString(),
        version_id: funnel.versions[0].id.toString(),
        version: funnel.versions[0].version,
        state: funnel.versions[0].state as FunnelVersionState,
        step_count: funnel.versions[0].steps.length,
        message: 'Funnel created successfully',
      };

      this.logger.log('Funnel created successfully', {
        funnelId: funnel.id.toString(),
        name: funnel.name,
        version: funnel.versions[0].version,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create funnel', {
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        name: request.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestException('Failed to create funnel');
    }
  }

  /**
   * Get a single funnel by ID
   */
  async getFunnelById(
    funnelId: string,
    tenantId: bigint,
    workspaceId: bigint,
  ): Promise<FunnelResponseDto> {
    this.logger.log('Getting funnel by ID', {
      funnelId,
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
    });

    // Check cache first
    const cached = await this.funnelCache.getCachedFunnelConfig(
      funnelId,
      tenantId.toString(),
      workspaceId.toString(),
    );

    if (cached) {
      this.logger.debug('Returning cached funnel', { funnelId });
      return cached;
    }

    // Get from database
    const funnel = await this.funnelRepository.getFunnelById(
      BigInt(funnelId),
      tenantId,
      workspaceId,
    );

    if (!funnel) {
      throw new NotFoundException(`Funnel with ID ${funnelId} not found`);
    }

    const response = this.transformFunnelToResponse(funnel);

    // Cache the result
    await this.funnelCache.cacheFunnelConfig(
      funnelId,
      tenantId.toString(),
      workspaceId.toString(),
      response,
    );

    return response;
  }

  /**
   * List funnels with pagination and filtering
   */
  async listFunnels(
    tenantId: bigint,
    workspaceId: bigint,
    query: ListFunnelsQueryDto,
  ): Promise<ListFunnelsResponseDto> {
    this.logger.log('Listing funnels', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      page: query.page,
      limit: query.limit,
      filters: { search: query.search, state: query.state },
    });

    const filters = {
      page: query.page || 1,
      limit: query.limit || 20,
      search: query.search,
      state: query.state,
      includeArchived: query.include_archived || false,
    };

    // Check cache first
    const cached = await this.funnelCache.getCachedFunnelList(
      tenantId.toString(),
      workspaceId.toString(),
      filters,
    );

    if (cached) {
      this.logger.debug('Returning cached funnel list', {
        count: cached.funnels.length,
      });
      return cached;
    }

    // Get from database
    const options: ListFunnelsOptions = {
      page: filters.page,
      limit: filters.limit,
      search: filters.search,
      state: filters.state,
      includeArchived: filters.includeArchived,
    };

    const { funnels, totalCount } = await this.funnelRepository.listFunnels(
      tenantId,
      workspaceId,
      options,
    );

    // Get summary statistics
    const summary = await this.funnelRepository.getFunnelSummary(tenantId, workspaceId);

    // Transform response
    const response: ListFunnelsResponseDto = {
      funnels: funnels.map(funnel => this.transformFunnelToResponse(funnel)),
      pagination: this.createPaginationMetadata(filters.page, filters.limit, totalCount),
      filters: {
        search: filters.search,
        state: filters.state,
        include_archived: filters.includeArchived,
      },
      summary: {
        total_funnels: summary.totalFunnels,
        draft_funnels: summary.draftFunnels,
        published_funnels: summary.publishedFunnels,
        archived_funnels: summary.archivedFunnels,
      },
    };

    // Cache the result
    await this.funnelCache.cacheFunnelList(
      tenantId.toString(),
      workspaceId.toString(),
      filters,
      response,
    );

    return response;
  }

  /**
   * Update an existing funnel
   */
  async updateFunnel(
    funnelId: string,
    tenantId: bigint,
    workspaceId: bigint,
    request: UpdateFunnelRequestDto,
  ): Promise<UpdateFunnelResponseDto> {
    this.logger.log('Updating funnel', {
      funnelId,
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      hasSteps: !!request.steps,
    });

    // Validate step ordering if steps are provided
    if (request.steps) {
      this.validateStepOrdering(request.steps);
    }

    // Transform request to repository format
    const updateData: UpdateFunnelData = {
      name: request.name,
      description: request.description,
      timeWindowDays: request.time_window_days,
      steps: request.steps?.map(step => ({
        order: step.order,
        type: step.type,
        label: step.label,
        metadata: step.metadata,
        matchingRules: step.matching_rules.map(rule => ({
          kind: rule.kind,
          rules: rule.rules,
        })),
      })),
    };

    try {
      const updatedFunnel = await this.funnelRepository.updateFunnel(
        BigInt(funnelId),
        tenantId,
        workspaceId,
        updateData,
      );

      if (!updatedFunnel) {
        throw new NotFoundException(`Funnel with ID ${funnelId} not found`);
      }

      // Invalidate caches
      await this.funnelCache.invalidateFunnelCache(
        funnelId,
        tenantId.toString(),
        workspaceId.toString(),
      );

      const currentVersion = updatedFunnel.versions[0];
      
      const response: UpdateFunnelResponseDto = {
        id: updatedFunnel.id.toString(),
        name: updatedFunnel.name,
        description: updatedFunnel.description || undefined,
        updated_at: new Date().toISOString(),
        new_version_id: currentVersion.id.toString(),
        new_version: currentVersion.version,
        state: currentVersion.state as FunnelVersionState,
        step_count: currentVersion.steps.length,
        message: 'Funnel updated successfully',
      };

      this.logger.log('Funnel updated successfully', {
        funnelId,
        newVersion: currentVersion.version,
      });

      return response;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error('Failed to update funnel', {
        funnelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BadRequestException('Failed to update funnel');
    }
  }

  /**
   * Archive a funnel (soft delete)
   */
  async archiveFunnel(
    funnelId: string,
    tenantId: bigint,
    workspaceId: bigint,
  ): Promise<ArchiveFunnelResponseDto> {
    this.logger.log('Archiving funnel', {
      funnelId,
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
    });

    const archivedFunnel = await this.funnelRepository.archiveFunnel(
      BigInt(funnelId),
      tenantId,
      workspaceId,
    );

    if (!archivedFunnel) {
      throw new NotFoundException(`Funnel with ID ${funnelId} not found`);
    }

    // Invalidate caches
    await this.funnelCache.invalidateFunnelCache(
      funnelId,
      tenantId.toString(),
      workspaceId.toString(),
    );

    const response: ArchiveFunnelResponseDto = {
      id: archivedFunnel.id.toString(),
      name: archivedFunnel.name,
      archived_at: archivedFunnel.archivedAt!.toISOString(),
      message: 'Funnel archived successfully',
    };

    this.logger.log('Funnel archived successfully', { funnelId });

    return response;
  }

  /**
   * Publish a funnel version
   */
  async publishFunnel(
    funnelId: string,
    version: number,
    tenantId: bigint,
    workspaceId: bigint,
    windowDays: number = 7,
    notes?: string,
  ): Promise<PublishFunnelResponseDto> {
    this.logger.log('Publishing funnel version', {
      funnelId,
      version,
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      windowDays,
    });

    const result = await this.funnelRepository.publishFunnelVersion(
      BigInt(funnelId),
      version,
      tenantId,
      workspaceId,
      windowDays,
      notes,
    );

    if (!result) {
      throw new NotFoundException(
        `Funnel with ID ${funnelId} version ${version} not found`
      );
    }

    // Invalidate caches
    await this.funnelCache.invalidateFunnelCache(
      funnelId,
      tenantId.toString(),
      workspaceId.toString(),
    );

    const response: PublishFunnelResponseDto = {
      funnel_id: funnelId,
      publication_id: result.publication.id.toString(),
      version,
      published_at: result.publication.publishedAt.toISOString(),
      window_days: result.publication.windowDays,
      notes: result.publication.notes || undefined,
      message: 'Funnel published successfully',
    };

    this.logger.log('Funnel published successfully', {
      funnelId,
      version,
      publicationId: result.publication.id.toString(),
    });

    return response;
  }

  /**
   * Transform database funnel to response DTO
   */
  private transformFunnelToResponse(funnel: any): FunnelResponseDto {
    const currentVersion = funnel.versions[0];
    const latestPublication = funnel.publications[0];

    return {
      id: funnel.id.toString(),
      name: funnel.name,
      description: funnel.description || undefined,
      created_at: funnel.createdAt.toISOString(),
      archived_at: funnel.archivedAt?.toISOString(),
      versions: funnel.versions.map((version: any) => ({
        id: version.id.toString(),
        version: version.version,
        state: version.state,
        created_at: version.createdAt.toISOString(),
        steps: version.steps.map((step: any) => ({
          id: step.id.toString(),
          order: step.orderIndex,
          type: step.type,
          label: step.label,
          metadata: step.metadata,
          matching_rules: step.matches.map((match: any) => ({
            kind: match.kind,
            rules: match.rules,
          })),
        })),
      })),
      publications: funnel.publications.map((pub: any) => ({
        id: pub.id.toString(),
        version: pub.version,
        published_at: pub.publishedAt.toISOString(),
        window_days: pub.windowDays,
        notes: pub.notes || undefined,
      })),
      current_version: currentVersion?.version || 0,
      current_state: currentVersion?.state || FunnelVersionState.DRAFT,
      published_version: latestPublication?.version,
      step_count: currentVersion?.steps.length || 0,
    };
  }

  /**
   * Create pagination metadata
   */
  private createPaginationMetadata(
    page: number,
    limit: number,
    totalCount: number,
  ): PaginationMetadata {
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_previous_page: page > 1,
    };
  }

  /**
   * Validate step ordering and configuration
   */
  private validateStepOrdering(steps: any[]): void {
    // Check for duplicate order values
    const orders = steps.map(step => step.order);
    const uniqueOrders = new Set(orders);
    
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Duplicate step order values found');
    }

    // Check for gaps in ordering
    const sortedOrders = [...orders].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i) {
        throw new BadRequestException(
          'Step ordering must be consecutive starting from 0'
        );
      }
    }

    // Validate step types
    const hasStart = steps.some(step => step.type === 'start');
    const hasConversion = steps.some(step => step.type === 'conversion');

    if (!hasStart) {
      throw new BadRequestException('Funnel must have at least one START step');
    }

    if (!hasConversion) {
      throw new BadRequestException('Funnel must have at least one CONVERSION step');
    }
  }
}