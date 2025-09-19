import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'Workspace name',
    example: 'Production Environment',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255, { message: 'Workspace name cannot exceed 255 characters' })
  name!: string

  @ApiPropertyOptional({
    description: 'Workspace description',
    example: 'Main production environment for analytics',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string

  @ApiPropertyOptional({
    description: 'Workspace-specific settings and configurations',
    example: {
      theme: 'light',
      timezone: 'UTC',
      retentionDays: 365,
      features: ['events', 'analytics', 'funnels'],
    },
  })
  @IsOptional()
  settings?: Record<string, any>

  @ApiPropertyOptional({
    description: 'Environment type for the workspace',
    example: 'production',
  })
  @IsOptional()
  @IsString()
  environment?: string

  @ApiPropertyOptional({
    description: 'Workspace-specific limits and quotas',
    example: {
      maxEventsPerMonth: 1000000,
      maxFunnels: 50,
      maxUsers: 25,
    },
  })
  @IsOptional()
  limits?: Record<string, any>
}
