/**
 * Example: Using Row Level Security (RLS) in Controllers
 * 
 * This example shows how to use the new RLS system in your controllers
 * after the security implementation.
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { PrismaRLSService, RLSContext } from '../src/common/services/prisma-rls.service';
import { GetRLSContext } from '../src/common/decorators/rls-context.decorator';

@Controller('examples')
export class ExampleController {
  constructor(private readonly prismaRLS: PrismaRLSService) {}

  /**
   * Example 1: Get events with automatic workspace isolation
   */
  @Get('events')
  async getEvents(@GetRLSContext() rlsContext: RLSContext) {
    // Create context-aware Prisma client
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // This query automatically enforces RLS policies
    // Users only see events from their accessible workspaces
    const events = await prisma.event.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        visitor: true  // Also filtered by RLS
      }
    });

    return { events, count: events.length };
  }

  /**
   * Example 2: Analytics query with role-based access
   */
  @Get('analytics')
  async getAnalytics(@GetRLSContext() rlsContext: RLSContext) {
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // All these queries respect RLS policies automatically
    const [totalEvents, uniqueVisitors, totalLeads] = await Promise.all([
      prisma.event.count(),
      prisma.visitor.count(),
      prisma.lead.count()  // PII data - extra secure
    ]);

    return {
      totalEvents,
      uniqueVisitors, 
      totalLeads,
      // Context info for debugging
      context: {
        tenantId: rlsContext?.tenantId,
        workspaceId: rlsContext?.workspaceId,
        userRole: rlsContext?.userRole,
        authType: rlsContext?.userRole === 'api_key' ? 'API Key' : 'JWT'
      }
    };
  }

  /**
   * Example 3: Creating data with RLS context
   */
  @Post('visitor')
  async createVisitor(
    @GetRLSContext() rlsContext: RLSContext,
    @Body() visitorData: { anonymousId: string }
  ) {
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // RLS policies automatically validate tenant/workspace access
    const visitor = await prisma.visitor.create({
      data: {
        anonymousId: visitorData.anonymousId,
        tenantId: BigInt(rlsContext.tenantId),
        workspaceId: BigInt(rlsContext.workspaceId),
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    return { visitor, message: 'Visitor created with RLS protection' };
  }

  /**
   * Example 4: Transaction with RLS context
   */
  @Post('funnel-with-steps')
  async createFunnelWithSteps(
    @GetRLSContext() rlsContext: RLSContext,
    @Body() funnelData: { name: string; description: string; steps: string[] }
  ) {
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    // All operations in transaction inherit RLS context
    const result = await prisma.$transaction(async (tx) => {
      // Create funnel - RLS validates workspace access
      const funnel = await tx.funnel.create({
        data: {
          name: funnelData.name,
          description: funnelData.description,
          tenantId: BigInt(rlsContext.tenantId),
          workspaceId: BigInt(rlsContext.workspaceId)
        }
      });

      // Create version - inherits RLS context
      const version = await tx.funnelVersion.create({
        data: {
          funnelId: funnel.id,
          version: 1,
          state: 'draft'
        }
      });

      // Create steps - all protected by RLS
      const steps = await Promise.all(
        funnelData.steps.map((stepName, index) =>
          tx.funnelStep.create({
            data: {
              funnelVersionId: version.id,
              orderIndex: index,
              type: index === 0 ? 'start' : 'page',
              label: stepName
            }
          })
        )
      );

      return { funnel, version, steps };
    });

    return {
      ...result,
      message: 'Funnel created with full RLS protection'
    };
  }

  /**
   * Example 5: Different behavior for API Keys vs JWT auth
   */
  @Get('user-context')
  async getUserContext(@GetRLSContext() rlsContext: RLSContext) {
    const prisma = this.prismaRLS.createContextualClient(rlsContext);
    
    if (rlsContext.userRole === 'api_key') {
      // API Key authentication
      return {
        authType: 'API Key',
        tenantId: rlsContext.tenantId,
        workspaceId: rlsContext.workspaceId,
        message: 'API key has access to specific workspace only',
        // API keys can't see user profiles
        canAccessUserProfiles: false
      };
    } else {
      // JWT authentication
      const userProfiles = await prisma.userProfile.findMany({
        take: 5
      });
      
      return {
        authType: 'JWT Token',
        userId: rlsContext.userId,
        userRole: rlsContext.userRole,
        tenantId: rlsContext.tenantId,
        workspaceId: rlsContext.workspaceId,
        message: 'JWT auth has role-based access',
        userProfiles: userProfiles.map(p => ({ id: p.id, email: p.email })),
        canAccessUserProfiles: true
      };
    }
  }
}

/**
 * Key Benefits Demonstrated:
 * 
 * 1. **Automatic Security**: All queries respect RLS policies
 * 2. **Zero Configuration**: Just use @GetRLSContext() decorator
 * 3. **Transparent**: Existing Prisma syntax works unchanged
 * 4. **Role-Based**: Different access levels automatically enforced
 * 5. **Multi-Tenant**: Perfect isolation between workspaces
 * 6. **Performance**: Optimized with proper indexes
 * 
 * Before RLS: Manual tenant_id filtering in every query (error-prone)
 * After RLS: Automatic database-level enforcement (bulletproof)
 */