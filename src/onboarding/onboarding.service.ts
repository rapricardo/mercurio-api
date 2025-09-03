import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MercurioLogger } from '../common/services/logger.service';
import { MetricsService } from '../common/services/metrics.service';
import { UserMappingService } from '../common/auth/user-mapping.service';
import { SupabaseUser } from '../common/auth/supabase-auth.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { OnboardingResponseDto } from './dto/onboarding-response.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercurioLogger: MercurioLogger,
    private readonly metrics: MetricsService,
    private readonly userMappingService: UserMappingService,
  ) {}

  /**
   * Creates tenant, workspace and auto-grants admin access in a single atomic transaction
   * Bypasses all workspace access checks for first-time onboarding
   */
  async createTenantAndWorkspace(
    dto: CreateOnboardingDto,
    user: SupabaseUser
  ): Promise<OnboardingResponseDto> {
    const startTime = Date.now();

    this.logger.log('🏗️ Starting onboarding creation', {
      userId: user.id,
      userEmail: user.email,
      tenantName: dto.tenantName,
      workspaceName: dto.workspaceName
    });

    try {
      // Check for duplicate tenant names
      const existingTenant = await this.prisma.tenant.findFirst({
        where: { 
          name: {
            equals: dto.tenantName.trim(),
            mode: 'insensitive',
          }
        },
      });

      if (existingTenant) {
        throw new ConflictException(`Tenant with name "${dto.tenantName}" already exists`);
      }

      // Atomic transaction: create tenant + workspace + user access
      const result = await this.prisma.$transaction(async (tx) => {
        this.logger.log('📦 Creating tenant in transaction', {
          tenantName: dto.tenantName.trim()
        });

        // 1. Create tenant
        const newTenant = await tx.tenant.create({
          data: {
            name: dto.tenantName.trim(),
            status: 'active',
            ...(dto.tenantDescription && { description: dto.tenantDescription }),
          },
        });

        this.logger.log('✅ Tenant created', {
          tenantId: newTenant.id.toString(),
          tenantName: newTenant.name
        });

        // 2. Create workspace within the tenant
        const newWorkspace = await tx.workspace.create({
          data: {
            tenantId: newTenant.id,
            name: dto.workspaceName.trim(),
            ...(dto.workspaceDescription && { description: dto.workspaceDescription }),
            ...(dto.workspaceEnvironment && { environment: dto.workspaceEnvironment }),
          },
        });

        this.logger.log('✅ Workspace created', {
          workspaceId: newWorkspace.id.toString(),
          workspaceName: newWorkspace.name,
          tenantId: newTenant.id.toString()
        });

        // 3. Create/update user profile
        await tx.userProfile.upsert({
          where: { id: user.id },
          update: {
            email: user.email!,
            name: user.name || user.email,
            lastLoginAt: new Date(),
            updatedAt: new Date()
          },
          create: {
            id: user.id,
            email: user.email!,
            name: user.name || user.email,
            lastLoginAt: new Date(),
          }
        });

        this.logger.log('✅ User profile created/updated', {
          userId: user.id,
          userEmail: user.email
        });

        // 4. Grant admin access to the new workspace
        const userAccess = await tx.userWorkspaceAccess.create({
          data: {
            userId: user.id,
            tenantId: newTenant.id,
            workspaceId: newWorkspace.id,
            role: 'admin',
            grantedBy: user.id, // Self-granted during onboarding
          }
        });

        this.logger.log('✅ Admin access granted', {
          userId: user.id,
          tenantId: newTenant.id.toString(),
          workspaceId: newWorkspace.id.toString(),
          role: 'admin'
        });

        return {
          tenant: newTenant,
          workspace: newWorkspace,
          userAccess
        };
      });

      // Build response
      const response: OnboardingResponseDto = {
        tenant: {
          id: result.tenant.id.toString(),
          name: result.tenant.name,
          status: result.tenant.status,
          createdAt: result.tenant.createdAt.toISOString(),
        },
        workspace: {
          id: result.workspace.id.toString(),
          tenantId: result.workspace.tenantId.toString(),
          name: result.workspace.name,
          description: (result.workspace as any).description || undefined,
          environment: (result.workspace as any).environment || undefined,
          createdAt: result.workspace.createdAt.toISOString(),
        },
        userAccess: {
          tenantId: result.userAccess.tenantId.toString(),
          workspaceId: result.userAccess.workspaceId.toString(),
          role: result.userAccess.role,
          grantedAt: result.userAccess.grantedAt.toISOString(),
        },
        message: `Successfully created tenant "${result.tenant.name}" with workspace "${result.workspace.name}" and granted admin access`
      };

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metrics.recordLatency('onboarding_processing_time', processingTime);
      this.metrics.incrementCounter('onboarding_requests');

      this.mercurioLogger.log('🎉 Onboarding completed successfully', {
        userId: user.id,
        tenantId: result.tenant.id.toString(),
        workspaceId: result.workspace.id.toString(),
        processingTimeMs: processingTime
      });

      return response;

    } catch (error) {
      this.logger.error('❌ Onboarding creation failed', {
        userId: user.id,
        tenantName: dto.tenantName,
        workspaceName: dto.workspaceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.metrics.incrementCounter('onboarding_errors');
      throw error;
    }
  }

  /**
   * Check if user already has any workspace access (to prevent duplicate onboarding)
   */
  async hasExistingAccess(userId: string): Promise<boolean> {
    try {
      const existingAccess = await this.prisma.userWorkspaceAccess.findFirst({
        where: {
          userId,
          revokedAt: null
        }
      });

      return !!existingAccess;
    } catch (error) {
      this.logger.error('Failed to check existing access', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}