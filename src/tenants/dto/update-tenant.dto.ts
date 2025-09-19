import { PartialType, ApiPropertyOptional } from '@nestjs/swagger'
import { CreateTenantDto } from './create-tenant.dto'
import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator'

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({
    description: 'Tenant name',
    example: 'Acme Corporation Updated',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tenant name cannot exceed 255 characters' })
  name?: string

  @ApiPropertyOptional({
    description: 'Tenant status',
    example: 'active',
    enum: ['active', 'inactive', 'suspended'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'], {
    message: 'Status must be one of: active, inactive, suspended',
  })
  status?: string

  @ApiPropertyOptional({
    description: 'Updated tenant-specific settings and configurations',
    example: {
      theme: 'dark',
      timezone: 'America/Sao_Paulo',
      features: ['analytics', 'funnels', 'export'],
    },
  })
  @IsOptional()
  settings?: Record<string, any>

  @ApiPropertyOptional({
    description: 'Updated subscription plan identifier',
    example: 'enterprise',
  })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiPropertyOptional({
    description: 'Updated tenant-specific limits and quotas',
    example: {
      maxUsers: 500,
      maxWorkspaces: 50,
      maxEventsPerMonth: 10000000,
    },
  })
  @IsOptional()
  limits?: Record<string, any>
}
