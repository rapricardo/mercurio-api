import 'fastify';
import { TenantContext } from './tenant-context.type';

declare module 'fastify' {
  interface FastifyRequest {
    [key: string]: any;
    requestContext?: {
      requestId: string;
      tenantId?: bigint;
      workspaceId?: bigint;
    };
  }
}

declare global {
  namespace NodeJS {
    interface IncomingMessage {
      [key: string]: any;
      requestContext?: {
        requestId: string;
        tenantId?: bigint;
        workspaceId?: bigint;
      };
    }
  }
}