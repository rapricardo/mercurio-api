import { IsNotEmpty, IsString, IsArray, IsOptional, MaxLength, ArrayMinSize } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'API Key name for identification',
    example: 'Production Analytics Key',
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255, { message: 'API key name cannot exceed 255 characters' })
  name!: string

  @ApiPropertyOptional({
    description: 'API key scopes/permissions',
    example: ['events:write', 'events:read'],
    default: ['events:write'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one scope is required' })
  @IsString({ each: true })
  scopes?: string[]
}
