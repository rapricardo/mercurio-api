import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../services/cache.service';
import { SupabaseUser } from './supabase-auth.service';

export interface UserWorkspaceAccess {
  tenantId: bigint;
  workspaceId: bigint;
  role: string;
  grantedAt: Date;
  revokedAt?: Date;
}

export interface UserMappingResult {
  isValid: boolean;
  user?: SupabaseUser;
  workspaceAccess: UserWorkspaceAccess[];
  defaultWorkspace?: {
    tenantId: bigint;
    workspaceId: bigint;
  };
}

@Injectable()
export class UserMappingService {
  private readonly logger = new Logger(UserMappingService.name);
  private readonly cacheKeyPrefix = 'user_mapping:';
  private readonly cacheTtlMs = parseInt(process.env.USER_MAPPING_CACHE_TTL || '300000'); // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  async getUserWorkspaceAccess(userId: string): Promise<UserMappingResult> {
    try {
      // Check cache first
      const cacheKey = `${this.cacheKeyPrefix}${userId}`;
      const cachedResult = this.cache.get<UserMappingResult>(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('User mapping cache hit', { userId });
        return cachedResult;
      }

      // Fetch user profile and workspace access from database
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { id: userId },
        include: {
          workspaceAccess: {
            where: { revokedAt: null }, // Only active access
            include: {
              tenant: true,
              workspace: true
            },
            orderBy: { grantedAt: 'asc' }
          }
        }
      });

      if (!userProfile) {
        this.logger.warn('User profile not found', { userId });
        const result: UserMappingResult = {
          isValid: false,
          workspaceAccess: []
        };
        
        // Cache negative result briefly
        this.cache.set(cacheKey, result, 60000); // 1 minute
        return result;
      }

      // Map workspace access
      const workspaceAccess: UserWorkspaceAccess[] = userProfile.workspaceAccess.map(access => ({
        tenantId: access.tenantId,
        workspaceId: access.workspaceId,
        role: access.role,
        grantedAt: access.grantedAt,
        revokedAt: access.revokedAt || undefined
      }));

      // Determine default workspace (first admin role, then first editor, then first viewer)
      let defaultWorkspace: { tenantId: bigint; workspaceId: bigint } | undefined;
      
      const adminAccess = workspaceAccess.find(access => access.role === 'admin');
      const editorAccess = workspaceAccess.find(access => access.role === 'editor');
      const viewerAccess = workspaceAccess.find(access => access.role === 'viewer');
      
      const primaryAccess = adminAccess || editorAccess || viewerAccess;
      if (primaryAccess) {
        defaultWorkspace = {
          tenantId: primaryAccess.tenantId,
          workspaceId: primaryAccess.workspaceId
        };
      }

      const result: UserMappingResult = {
        isValid: true,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name || undefined
        },
        workspaceAccess,
        defaultWorkspace
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cacheTtlMs);

      this.logger.debug('User mapping fetched', {
        userId,
        workspacesCount: workspaceAccess.length,
        defaultWorkspace: defaultWorkspace?.workspaceId.toString()
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to fetch user workspace access', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        workspaceAccess: []
      };
    }
  }

  async grantWorkspaceAccess(
    userId: string,
    tenantId: bigint,
    workspaceId: bigint,
    role: string,
    grantedBy?: string
  ): Promise<boolean> {
    try {
      // Validate workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { tenant: true }
      });

      if (!workspace || workspace.tenantId !== tenantId) {
        this.logger.warn('Invalid workspace for access grant', { tenantId, workspaceId });
        return false;
      }

      // Upsert access record
      await this.prisma.userWorkspaceAccess.upsert({
        where: {
          unique_user_workspace: {
            userId,
            tenantId,
            workspaceId
          }
        },
        update: {
          role,
          revokedAt: null, // Re-activate if previously revoked
          grantedBy
        },
        create: {
          userId,
          tenantId,
          workspaceId,
          role,
          grantedBy
        }
      });

      // Invalidate cache
      this.invalidateUserCache(userId);

      this.logger.log('Workspace access granted', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        role,
        grantedBy
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to grant workspace access', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        role,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async revokeWorkspaceAccess(
    userId: string,
    tenantId: bigint,
    workspaceId: bigint
  ): Promise<boolean> {
    try {
      await this.prisma.userWorkspaceAccess.updateMany({
        where: {
          userId,
          tenantId,
          workspaceId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      // Invalidate cache
      this.invalidateUserCache(userId);

      this.logger.log('Workspace access revoked', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString()
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to revoke workspace access', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async updateUserRole(
    userId: string,
    tenantId: bigint,
    workspaceId: bigint,
    role: string
  ): Promise<boolean> {
    try {
      const result = await this.prisma.userWorkspaceAccess.updateMany({
        where: {
          userId,
          tenantId,
          workspaceId,
          revokedAt: null
        },
        data: { role }
      });

      if (result.count === 0) {
        this.logger.warn('No active workspace access found to update', {
          userId,
          tenantId: tenantId.toString(),
          workspaceId: workspaceId.toString()
        });
        return false;
      }

      // Invalidate cache
      this.invalidateUserCache(userId);

      this.logger.log('User role updated', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        role
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to update user role', {
        userId,
        tenantId: tenantId.toString(),
        workspaceId: workspaceId.toString(),
        role,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async hasWorkspaceAccess(
    userId: string,
    tenantId: bigint,
    workspaceId: bigint,
    requiredRole?: string
  ): Promise<boolean> {
    const mapping = await this.getUserWorkspaceAccess(userId);
    
    if (!mapping.isValid) {
      return false;
    }

    const access = mapping.workspaceAccess.find(
      access => access.tenantId === tenantId && access.workspaceId === workspaceId
    );

    if (!access) {
      return false;
    }

    // If no specific role required, any access is sufficient
    if (!requiredRole) {
      return true;
    }

    // Role hierarchy check
    const roleHierarchy = ['viewer', 'editor', 'admin'];
    const userRoleIndex = roleHierarchy.indexOf(access.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    return userRoleIndex >= requiredRoleIndex;
  }

  async createUserProfile(user: SupabaseUser): Promise<boolean> {
    try {
      await this.prisma.userProfile.upsert({
        where: { id: user.id },
        update: {
          email: user.email!,
          name: user.name,
          avatarUrl: user.user_metadata?.avatar_url,
          lastLoginAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          id: user.id,
          email: user.email!,
          name: user.name,
          avatarUrl: user.user_metadata?.avatar_url,
          lastLoginAt: new Date()
        }
      });

      this.logger.debug('User profile created/updated', {
        userId: user.id,
        email: user.email
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to create/update user profile', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private invalidateUserCache(userId: string): void {
    const cacheKey = `${this.cacheKeyPrefix}${userId}`;
    this.cache.delete(cacheKey);
    this.logger.debug('User mapping cache invalidated', { userId });
  }

  /**
   * Public method to invalidate user cache (for external services like onboarding)
   */
  public invalidateUser(userId: string): void {
    this.invalidateUserCache(userId);
  }

  /**
   * Clear user mapping cache
   */
  clearCache(): void {
    const entries = this.cache.getEntries();
    let clearedCount = 0;

    for (const { key } of entries) {
      if (key.startsWith(this.cacheKeyPrefix)) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    this.logger.log(`Cleared ${clearedCount} user mapping cache entries`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}