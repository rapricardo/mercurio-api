import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ApiKeyService } from './api-key.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { UserMappingService } from './user-mapping.service';
import { TenantContext } from '../types/tenant-context.type';
import { REQUEST_CONTEXT_KEY } from '../middleware/request-context.middleware';

export interface HybridTenantContext extends TenantContext {
  // API Key auth fields (existing)
  tenantId: bigint;
  workspaceId: bigint;
  apiKeyId: bigint;
  scopes: string[];
  
  // Supabase auth fields (new)
  userId?: string;
  userEmail?: string;
  userRole?: string;
  authType: 'api_key' | 'supabase_jwt';
  
  // Workspace access for JWT auth
  workspaceAccess?: Array<{
    tenantId: bigint;
    workspaceId: bigint;
    role: string;
  }>;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantContext?: HybridTenantContext;
  }
}

@Injectable()
export class HybridAuthGuard implements CanActivate {
  private readonly logger = new Logger(HybridAuthGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly userMappingService: UserMappingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    try {
      // Detect authentication type by token format
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // API Key format: ak_xxxxx
        if (token.startsWith('ak_')) {
          return await this.handleApiKeyAuth(request, token);
        }
        
        // JWT format: long base64 token
        return await this.handleSupabaseJWTAuth(request, token);
      }
      
      // Direct API key (legacy support): ak_xxxxx
      if (authHeader.startsWith('ak_')) {
        return await this.handleApiKeyAuth(request, authHeader);
      }

      throw new UnauthorizedException('Invalid authorization format');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error('Authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private async handleApiKeyAuth(request: FastifyRequest, apiKey: string): Promise<boolean> {
    this.logger.debug('Processing API Key authentication');
    
    const validation = await this.apiKeyService.validateKey(apiKey);
    
    if (!validation.isValid || !validation.tenantId || !validation.workspaceId || !validation.apiKeyId) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Set traditional tenant context for API key auth
    const tenantContext: HybridTenantContext = {
      tenantId: validation.tenantId,
      workspaceId: validation.workspaceId,
      apiKeyId: validation.apiKeyId,
      scopes: validation.scopes,
      authType: 'api_key'
    };

    request.tenantContext = tenantContext;
    // Populate request context for downstream middlewares/guards (rate limit, logging)
    try {
      const raw: any = (request as any).raw || {};
      const reqCtx = (raw[REQUEST_CONTEXT_KEY] ||= {});
      reqCtx.tenantId = tenantContext.tenantId?.toString();
      reqCtx.workspaceId = tenantContext.workspaceId?.toString();
      reqCtx.apiKeyId = tenantContext.apiKeyId?.toString();
    } catch {
      // best-effort only
    }
    
    this.logger.debug('API Key authentication successful', {
      tenantId: validation.tenantId.toString(),
      workspaceId: validation.workspaceId.toString(),
      apiKeyId: validation.apiKeyId.toString()
    });

    return true;
  }

  private async handleSupabaseJWTAuth(request: FastifyRequest, token: string): Promise<boolean> {
    this.logger.debug('Processing Supabase JWT authentication');
    
    const validation = await this.supabaseAuthService.validateJWT(token);
    
    if (!validation.isValid || !validation.user) {
      throw new UnauthorizedException(validation.error || 'Invalid JWT token');
    }

    // Get user workspace access
    const userMapping = await this.userMappingService.getUserWorkspaceAccess(validation.user.id);
    
    if (!userMapping.isValid || userMapping.workspaceAccess.length === 0) {
      throw new UnauthorizedException('User has no workspace access');
    }

    // Create or update user profile
    await this.userMappingService.createUserProfile(validation.user);

    // Use default workspace or require workspace selection
    if (!userMapping.defaultWorkspace) {
      throw new UnauthorizedException('User has no default workspace configured');
    }

    // Set hybrid tenant context for JWT auth
    const tenantContext: HybridTenantContext = {
      // Required fields for compatibility
      tenantId: userMapping.defaultWorkspace.tenantId,
      workspaceId: userMapping.defaultWorkspace.workspaceId,
      apiKeyId: BigInt(0), // No API key for JWT auth
      scopes: this.mapRoleToScopes(userMapping.workspaceAccess[0]?.role || 'viewer'),
      
      // JWT-specific fields
      userId: validation.user.id,
      userEmail: validation.user.email,
      userRole: userMapping.workspaceAccess[0]?.role,
      authType: 'supabase_jwt',
      workspaceAccess: userMapping.workspaceAccess
    };

    request.tenantContext = tenantContext;
    // Populate request context for downstream middlewares/guards (rate limit, logging)
    try {
      const raw: any = (request as any).raw || {};
      const reqCtx = (raw[REQUEST_CONTEXT_KEY] ||= {});
      reqCtx.tenantId = tenantContext.tenantId?.toString();
      reqCtx.workspaceId = tenantContext.workspaceId?.toString();
      reqCtx.userId = tenantContext.userId;
    } catch {
      // best-effort only
    }
    
    this.logger.debug('JWT authentication successful', {
      userId: validation.user.id,
      userEmail: validation.user.email,
      tenantId: userMapping.defaultWorkspace.tenantId.toString(),
      workspaceId: userMapping.defaultWorkspace.workspaceId.toString(),
      workspaceCount: userMapping.workspaceAccess.length
    });

    return true;
  }

  private mapRoleToScopes(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['*', 'read', 'write', 'events:read', 'events:write', 'analytics:read', 'analytics:write'];
      case 'editor':
        return ['read', 'write', 'events:read', 'events:write', 'analytics:read', 'analytics:write'];
      case 'viewer':
        return ['read', 'analytics:read'];
      default:
        return ['read'];
    }
  }
}

// Helper decorator for checking workspace access
export function RequireWorkspaceAccess(tenantId?: string, workspaceId?: string, role?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const request = args.find(arg => arg && arg.tenantContext);
      
      if (!request?.tenantContext) {
        throw new UnauthorizedException('No authentication context');
      }

      const context = request.tenantContext as HybridTenantContext;
      
      // For API Key auth, use existing tenant/workspace from key
      if (context.authType === 'api_key') {
        // API keys are already scoped to their workspace
        return method.apply(this, args);
      }

      // For JWT auth, check workspace access
      if (context.authType === 'supabase_jwt' && context.workspaceAccess) {
        const requestedTenantId = tenantId ? BigInt(tenantId) : context.tenantId;
        const requestedWorkspaceId = workspaceId ? BigInt(workspaceId) : context.workspaceId;
        
        const hasAccess = context.workspaceAccess.some(access => 
          access.tenantId === requestedTenantId &&
          access.workspaceId === requestedWorkspaceId &&
          (!role || hasRequiredRole(access.role, role))
        );

        if (!hasAccess) {
          throw new UnauthorizedException('Insufficient workspace access');
        }
      }

      return method.apply(this, args);
    };
  };
}

function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = ['viewer', 'editor', 'admin'];
  const userRoleIndex = roleHierarchy.indexOf(userRole);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
  return userRoleIndex >= requiredRoleIndex;
}
