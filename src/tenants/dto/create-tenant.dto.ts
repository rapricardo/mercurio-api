import { IsNotEmpty, IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255, { message: 'Tenant name cannot exceed 255 characters' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Tenant status',
    example: 'active',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'], {
    message: 'Status must be one of: active, inactive, suspended',
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Tenant-specific settings and configurations',
    example: {
      theme: 'light',
      timezone: 'UTC',
      features: ['analytics', 'funnels'],
    },
  })
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Subscription plan identifier',
    example: 'pro',
  })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({
    description: 'Tenant-specific limits and quotas',
    example: {
      maxUsers: 100,
      maxWorkspaces: 10,
      maxEventsPerMonth: 1000000,
    },
  })
  @IsOptional()
  limits?: Record<string, any>;
}