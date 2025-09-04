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
      // Check if user already has workspace access (prevent duplicate onboarding)
      const hasExistingAccess = await this.hasExistingAccess(user.id);
      if (hasExistingAccess) {
        this.logger.warn('🚫 User already has workspace access', { userId: user.id });
        throw new ConflictException('User already has workspace access. Please contact support if you need additional workspaces.');
      }

      // Check for duplicate tenant names with retry on prepared statement error
      const existingTenant = await this.executeWithRetry(async () => {
        return await this.prisma.tenant.findFirst({
          where: { 
            name: {
              equals: dto.tenantName.trim(),
              mode: 'insensitive',
            }
          },
        });
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

      // Invalidate user mapping cache to ensure fresh access data
      this.userMappingService.invalidateUser(user.id);
      this.logger.debug('🗑️ User cache invalidated after onboarding', { userId: user.id });

      return response;

    } catch (error) {
      this.logger.error('❌ Onboarding creation failed', {
        userId: user.id,
        tenantName: dto.tenantName,
        workspaceName: dto.workspaceName,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any)?.code
      });

      this.metrics.incrementCounter('onboarding_errors');

      // Handle Prisma-specific errors
      if ((error as any)?.code === 'P2002') {
        // Unique constraint violation
        const target = (error as any)?.meta?.target;
        if (target?.includes('name')) {
          throw new ConflictException(`A ${target.includes('tenant') ? 'company' : 'workspace'} with this name already exists. Please choose a different name.`);
        }
        if (target?.includes('unique_user_workspace')) {
          throw new ConflictException('User already has access to this workspace.');
        }
        throw new ConflictException('A record with these details already exists.');
      }

      // Re-throw other errors as-is (including ConflictException from hasExistingAccess)
      throw error;
    }
  }

  /**
   * Check if user already has any workspace access (to prevent duplicate onboarding)
   */
  async hasExistingAccess(userId: string): Promise<boolean> {
    try {
      const existingAccess = await this.executeWithRetry(async () => {
        return await this.prisma.userWorkspaceAccess.findFirst({
          where: {
            userId,
            revokedAt: null
          }
        });
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

  /**
   * Execute database operation with retry on prepared statement errors
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries: number = 2): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isPreparedStatementError = (error as any)?.code === 'P2017' || 
                                       (error as any)?.message?.includes('prepared statement') ||
                                       (error as any)?.message?.includes('already exists');
        
        if (isPreparedStatementError && attempt < maxRetries) {
          this.logger.warn(`🔄 Prepared statement error detected, retrying (${attempt}/${maxRetries})`, {
            error: (error as any)?.message,
            attempt
          });
          
          // Reset Prisma connection
          await this.prisma.resetConnection();
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }
        
        // Re-throw if not a prepared statement error or max retries reached
        throw error;
      }
    }
    
    throw new Error('Max retries reached');
  }
}