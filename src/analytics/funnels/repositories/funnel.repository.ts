import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { CreateFunnelRequestDto, UpdateFunnelRequestDto, ListFunnelsQueryDto } from '../dto/funnel-request.dto';
import { FunnelVersionState } from '../dto/funnel-request.dto';
import { Prisma } from '@prisma/client';

// Type definitions for repository operations
export interface CreateFunnelData {
  name: string;
  description?: string;
  tenantId: bigint;
  workspaceId: bigint;
  timeWindowDays: number;
  steps: Array<{
    order: number;
    type: string;
    label: string;
    metadata?: Record<string, any>;
    matchingRules: Array<{
      kind: string;
      rules: Record<string, any>;
    }>;
  }>;
}

export interface UpdateFunnelData {
  name?: string;
  description?: string;
  timeWindowDays?: number;
  steps?: Array<{
    order: number;
    type: string;
    label: string;
    metadata?: Record<string, any>;
    matchingRules: Array<{
      kind: string;
      rules: Record<string, any>;
    }>;
  }>;
}

export interface ListFunnelsOptions {
  page: number;
  limit: number;
  search?: string;
  state?: FunnelVersionState;
  includeArchived: boolean;
}

// Full funnel data with relations
export type FunnelWithRelations = Prisma.FunnelGetPayload<{
  include: {
    versions: {
      include: {
        steps: {
          include: {
            matches: true;
          };
          orderBy: {
            orderIndex: 'asc';
          };
        };
      };
      orderBy: {
        version: 'desc';
      };
    };
    publications: {
      orderBy: {
        publishedAt: 'desc';
      };
    };
  };
}>;

@Injectable()
export class FunnelRepository {
  private readonly logger = new Logger(FunnelRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new funnel with its first version and steps
   */
  async createFunnel(data: CreateFunnelData): Promise<FunnelWithRelations> {
    this.logger.log('Creating new funnel', {
      name: data.name,
      tenantId: data.tenantId.toString(),
      workspaceId: data.workspaceId.toString(),
      stepCount: data.steps.length,
    });

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create the funnel
      const funnel = await tx.funnel.create({
        data: {
          name: data.name,
          description: data.description,
          tenantId: data.tenantId,
          workspaceId: data.workspaceId,
        },
      });

      // 2. Create the first version
      const version = await tx.funnelVersion.create({
        data: {
          funnelId: funnel.id,
          version: 1,
          state: FunnelVersionState.DRAFT,
        },
      });

      // 3. Create steps for this version
      for (const stepData of data.steps) {
        const step = await tx.funnelStep.create({
          data: {
            funnelVersionId: version.id,
            orderIndex: stepData.order,
            type: stepData.type,
            label: stepData.label,
            metadata: stepData.metadata,
          },
        });

        // 4. Create matching rules for each step
        for (const ruleData of stepData.matchingRules) {
          await tx.funnelStepMatch.create({
            data: {
              funnelStepId: step.id,
              kind: ruleData.kind,
              rules: ruleData.rules,
            },
          });
        }
      }

      // 5. Return the complete funnel with all relations
      return await tx.funnel.findUnique({
        where: { id: funnel.id },
        include: {
          versions: {
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: {
                  orderIndex: 'asc',
                },
              },
            },
            orderBy: {
              version: 'desc',
            },
          },
          publications: {
            orderBy: {
              publishedAt: 'desc',
            },
          },
        },
      }) as FunnelWithRelations;
    });
  }

  /**
   * Get a single funnel by ID
   */
  async getFunnelById(
    id: bigint,
    tenantId: bigint,
    workspaceId: bigint,
  ): Promise<FunnelWithRelations | null> {
    return await this.prisma.funnel.findFirst({
      where: {
        id,
        tenantId,
        workspaceId,
        archivedAt: null,
      },
      include: {
        versions: {
          include: {
            steps: {
              include: {
                matches: true,
              },
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
          orderBy: {
            version: 'desc',
          },
        },
        publications: {
          orderBy: {
            publishedAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * List funnels with pagination and filtering
   */
  async listFunnels(
    tenantId: bigint,
    workspaceId: bigint,
    options: ListFunnelsOptions,
  ): Promise<{
    funnels: FunnelWithRelations[];
    totalCount: number;
  }> {
    const { page, limit, search, state, includeArchived } = options;
    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions: Prisma.FunnelWhereInput = {
      tenantId,
      workspaceId,
    };

    // Include archived filter
    if (!includeArchived) {
      whereConditions.archivedAt = null;
    }

    // Search filter
    if (search) {
      whereConditions.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // State filter (requires joining with versions)
    if (state) {
      whereConditions.versions = {
        some: {
          state,
        },
      };
    }

    // Execute count and data queries in parallel
    const [totalCount, funnels] = await Promise.all([
      this.prisma.funnel.count({ where: whereConditions }),
      this.prisma.funnel.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          versions: {
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: {
                  orderIndex: 'asc',
                },
              },
            },
            orderBy: {
              version: 'desc',
            },
          },
          publications: {
            orderBy: {
              publishedAt: 'desc',
            },
          },
        },
      }),
    ]);

    this.logger.log('Listed funnels', {
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      totalCount,
      returnedCount: funnels.length,
      page,
      limit,
      filters: { search, state, includeArchived },
    });

    return { funnels, totalCount };
  }

  /**
   * Update a funnel by creating a new version
   */
  async updateFunnel(
    id: bigint,
    tenantId: bigint,
    workspaceId: bigint,
    data: UpdateFunnelData,
  ): Promise<FunnelWithRelations | null> {
    this.logger.log('Updating funnel', {
      funnelId: id.toString(),
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
    });

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verify funnel exists and belongs to tenant/workspace
      const existingFunnel = await tx.funnel.findFirst({
        where: {
          id,
          tenantId,
          workspaceId,
          archivedAt: null,
        },
        include: {
          versions: {
            orderBy: {
              version: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!existingFunnel) {
        return null;
      }

      // 2. Update basic funnel properties if provided
      const updatedFunnel = await tx.funnel.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
      });

      // 3. If steps are provided, create a new version
      if (data.steps) {
        const currentVersion = existingFunnel.versions[0]?.version || 0;
        const newVersionNumber = currentVersion + 1;

        const newVersion = await tx.funnelVersion.create({
          data: {
            funnelId: id,
            version: newVersionNumber,
            state: FunnelVersionState.DRAFT,
          },
        });

        // 4. Create steps for the new version
        for (const stepData of data.steps) {
          const step = await tx.funnelStep.create({
            data: {
              funnelVersionId: newVersion.id,
              orderIndex: stepData.order,
              type: stepData.type,
              label: stepData.label,
              metadata: stepData.metadata,
            },
          });

          // 5. Create matching rules for each step
          for (const ruleData of stepData.matchingRules) {
            await tx.funnelStepMatch.create({
              data: {
                funnelStepId: step.id,
                kind: ruleData.kind,
                rules: ruleData.rules,
              },
            });
          }
        }
      }

      // 6. Return updated funnel with relations
      return await tx.funnel.findUnique({
        where: { id },
        include: {
          versions: {
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: {
                  orderIndex: 'asc',
                },
              },
            },
            orderBy: {
              version: 'desc',
            },
          },
          publications: {
            orderBy: {
              publishedAt: 'desc',
            },
          },
        },
      }) as FunnelWithRelations;
    });
  }

  /**
   * Archive a funnel (soft delete)
   */
  async archiveFunnel(
    id: bigint,
    tenantId: bigint,
    workspaceId: bigint,
  ): Promise<FunnelWithRelations | null> {
    this.logger.log('Archiving funnel', {
      funnelId: id.toString(),
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
    });

    const archivedFunnel = await this.prisma.funnel.updateMany({
      where: {
        id,
        tenantId,
        workspaceId,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    if (archivedFunnel.count === 0) {
      return null;
    }

    return await this.getFunnelById(id, tenantId, workspaceId);
  }

  /**
   * Publish a specific version of a funnel
   */
  async publishFunnelVersion(
    funnelId: bigint,
    version: number,
    tenantId: bigint,
    workspaceId: bigint,
    windowDays: number = 7,
    notes?: string,
  ): Promise<{ publication: any; funnel: FunnelWithRelations } | null> {
    this.logger.log('Publishing funnel version', {
      funnelId: funnelId.toString(),
      version,
      tenantId: tenantId.toString(),
      workspaceId: workspaceId.toString(),
      windowDays,
    });

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verify funnel and version exist
      const funnelVersion = await tx.funnelVersion.findFirst({
        where: {
          funnel: {
            id: funnelId,
            tenantId,
            workspaceId,
            archivedAt: null,
          },
          version,
        },
      });

      if (!funnelVersion) {
        return null;
      }

      // 2. Update version state to published
      await tx.funnelVersion.update({
        where: { id: funnelVersion.id },
        data: { state: FunnelVersionState.PUBLISHED },
      });

      // 3. Create publication record
      const publication = await tx.funnelPublication.create({
        data: {
          funnelId,
          version,
          windowDays,
          notes,
        },
      });

      // 4. Get updated funnel with relations
      const funnel = (await tx.funnel.findUnique({
        where: { id: funnelId },
        include: {
          versions: {
            include: {
              steps: {
                include: {
                  matches: true,
                },
                orderBy: {
                  orderIndex: 'asc',
                },
              },
            },
            orderBy: {
              version: 'desc',
            },
          },
          publications: {
            orderBy: {
              publishedAt: 'desc',
            },
          },
        },
      })) as FunnelWithRelations;

      return { publication, funnel };
    });
  }

  /**
   * Get funnel summary statistics for a workspace
   */
  async getFunnelSummary(tenantId: bigint, workspaceId: bigint) {
    const [totalFunnels, draftFunnels, publishedFunnels, archivedFunnels] = await Promise.all([
      this.prisma.funnel.count({
        where: { tenantId, workspaceId, archivedAt: null },
      }),
      this.prisma.funnel.count({
        where: {
          tenantId,
          workspaceId,
          archivedAt: null,
          versions: { some: { state: FunnelVersionState.DRAFT } },
        },
      }),
      this.prisma.funnel.count({
        where: {
          tenantId,
          workspaceId,
          archivedAt: null,
          versions: { some: { state: FunnelVersionState.PUBLISHED } },
        },
      }),
      this.prisma.funnel.count({
        where: { tenantId, workspaceId, archivedAt: { not: null } },
      }),
    ]);

    return {
      totalFunnels,
      draftFunnels,
      publishedFunnels,
      archivedFunnels,
    };
  }
}