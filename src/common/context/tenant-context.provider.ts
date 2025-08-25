import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { TenantContext } from '../types/tenant-context.type'

export const TENANT_CONTEXT_KEY = 'tenantContext'

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest()
    const tenantContext = request[TENANT_CONTEXT_KEY]
    
    if (!tenantContext) {
      throw new Error('Tenant context not found in request. Ensure ApiKeyGuard is applied.')
    }
    
    return tenantContext
  },
)