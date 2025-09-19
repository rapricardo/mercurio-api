import { PartialType, ApiPropertyOptional } from '@nestjs/swagger'
import { CreateWorkspaceDto } from './create-workspace.dto'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @ApiPropertyOptional({
    description: 'Workspace name',
    example: 'Production Environment Updated',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Workspace name cannot exceed 255 characters' })
  name?: string

  @ApiPropertyOptional({
    description: 'Workspace description',
    example: 'Updated production environment for analytics',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string

  @ApiPropertyOptional({
    description: 'Updated workspace-specific settings and configurations',
    example: {
      theme: 'dark',
      timezone: 'America/Sao_Paulo',
      retentionDays: 730,
      features: ['events', 'analytics', 'funnels', 'export'],
    },
  })
  @IsOptional()
  settings?: Record<string, any>

  @ApiPropertyOptional({
    description: 'Updated environment type for the workspace',
    example: 'staging',
  })
  @IsOptional()
  @IsString()
  environment?: string

  @ApiPropertyOptional({
    description: 'Updated workspace-specific limits and quotas',
    example: {
      maxEventsPerMonth: 5000000,
      maxFunnels: 100,
      maxUsers: 50,
    },
  })
  @IsOptional()
  limits?: Record<string, any>
}
