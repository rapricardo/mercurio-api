import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface RLSContext {
  tenantId: string;
  workspaceId: string;
  userRole: string;
  userId?: string;
}

@Injectable()
export class PrismaRLSService {
  private readonly logger = new Logger(PrismaRLSService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a database operation with RLS context
   * This sets the session variables that our RLS policies use
   */
  async withRLSContext<T>(
    context: RLSContext | null,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!context) {
      // No RLS context - execute directly (for internal operations)
      return await operation();
    }

    // Set session variables for RLS policies
    try {
      await this.prisma.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${context.tenantId}, true),
               set_config('app.current_workspace_id', ${context.workspaceId}, true),
               set_config('app.current_user_role', ${context.userRole}, true)
               ${context.userId ? this.prisma.$queryRaw`, set_config('app.current_user_id', ${context.userId}, true)` : this.prisma.$queryRaw``};
      `;
      
      this.logger.debug('RLS session variables applied', {
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        userRole: context.userRole,
        userId: context.userId
      });

      // Execute the operation with RLS context
      return await operation();
    } catch (error) {
      this.logger.error('Failed to execute operation with RLS context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
      throw error;
    } finally {
      // Clean up session variables (optional, as they're scoped to the connection)
      try {
        await this.prisma.$executeRaw`
          SELECT set_config('app.current_tenant_id', NULL, true),
                 set_config('app.current_workspace_id', NULL, true),
                 set_config('app.current_user_role', NULL, true),
                 set_config('app.current_user_id', NULL, true);
        `;
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Create a Prisma client wrapper that automatically applies RLS context
   */
  createContextualClient(context: RLSContext | null) {
    return {
      // Proxy common Prisma operations
      tenant: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.tenant.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.tenant.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.tenant.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.tenant.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.tenant.update(args)),
        delete: (args: any) => this.withRLSContext(context, () => this.prisma.tenant.delete(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.tenant.count(args)),
      },
      workspace: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.workspace.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.workspace.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.workspace.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.workspace.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.workspace.update(args)),
        delete: (args: any) => this.withRLSContext(context, () => this.prisma.workspace.delete(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.workspace.count(args)),
      },
      event: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.event.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.event.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.event.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.event.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.event.update(args)),
        delete: (args: any) => this.withRLSContext(context, () => this.prisma.event.delete(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.event.count(args)),
        createMany: (args: any) => this.withRLSContext(context, () => this.prisma.event.createMany(args)),
      },
      visitor: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.visitor.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.visitor.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.visitor.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.visitor.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.visitor.update(args)),
        upsert: (args: any) => this.withRLSContext(context, () => this.prisma.visitor.upsert(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.visitor.count(args)),
      },
      lead: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.lead.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.lead.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.lead.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.lead.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.lead.update(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.lead.count(args)),
      },
      session: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.session.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.session.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.session.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.session.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.session.update(args)),
        upsert: (args: any) => this.withRLSContext(context, () => this.prisma.session.upsert(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.session.count(args)),
      },
      userProfile: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.userProfile.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.userProfile.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.userProfile.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.userProfile.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.userProfile.update(args)),
        upsert: (args: any) => this.withRLSContext(context, () => this.prisma.userProfile.upsert(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.userProfile.count(args)),
      },
      userWorkspaceAccess: {
        findMany: (args?: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.findMany(args)),
        findUnique: (args: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.findUnique(args)),
        findFirst: (args?: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.findFirst(args)),
        create: (args: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.create(args)),
        update: (args: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.update(args)),
        count: (args?: any) => this.withRLSContext(context, () => this.prisma.userWorkspaceAccess.count(args)),
      },
      // Add other models as needed
      $transaction: <T>(operations: any[]) => {
        return this.withRLSContext(context, () => this.prisma.$transaction(operations));
      },
      $executeRaw: (query: any, ...values: any[]) => {
        return this.withRLSContext(context, () => this.prisma.$executeRaw(query, ...values));
      },
      $queryRaw: (query: any, ...values: any[]) => {
        return this.withRLSContext(context, () => this.prisma.$queryRaw(query, ...values));
      }
    };
  }

  /**
   * Extract RLS context from Fastify request
   */
  static extractRLSContext(request: any): RLSContext | null {
    const context = request?.rlsContext;
    if (!context) {
      return null;
    }

    return {
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      userRole: context.userRole,
      userId: context.userId
    };
  }
}