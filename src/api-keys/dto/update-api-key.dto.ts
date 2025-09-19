import { IsOptional, IsString, IsArray, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateApiKeyDto {
  @ApiPropertyOptional({
    description: 'Update API Key name',
    example: 'Updated Production Key',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'API key name cannot exceed 255 characters' })
  name?: string

  @ApiPropertyOptional({
    description: 'Update API key scopes/permissions',
    example: ['events:write', 'events:read', 'analytics:read'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[]
}
