import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaRLSService, RLSContext } from '../services/prisma-rls.service';

/**
 * Parameter decorator to extract RLS context from request
 * Usage: @RLSContext() rlsContext: RLSContext
 */
export const RLSContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RLSContext | null => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return PrismaRLSService.extractRLSContext(request);
  },
);

/**
 * Property decorator to inject PrismaRLS service with automatic context
 * Usage: @InjectPrismaRLS() private prisma: any
 */
export const InjectPrismaRLS = () => {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) => {
    // This will be injected at runtime with context-aware client
    // Implementation depends on your DI container
  };
};