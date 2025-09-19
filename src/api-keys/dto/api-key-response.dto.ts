import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'API Key unique identifier',
    example: '1',
  })
  id!: string

  @ApiProperty({
    description: 'API Key name for identification',
    example: 'Production Analytics Key',
  })
  name!: string

  @ApiProperty({
    description: 'API key scopes/permissions',
    example: ['events:write', 'events:read'],
  })
  scopes!: string[]

  @ApiProperty({
    description: 'API Key prefix (first 8 chars for identification)',
    example: 'ak_12345678...',
  })
  keyPrefix!: string

  @ApiProperty({
    description: 'Workspace ID the API key belongs to',
    example: '1',
  })
  workspaceId!: string

  @ApiPropertyOptional({
    description: 'Last time the API key was used',
    example: '2024-01-15T10:30:00Z',
  })
  lastUsedAt?: Date

  @ApiProperty({
    description: 'When the API key was created',
    example: '2024-01-01T08:00:00Z',
  })
  createdAt!: Date

  @ApiProperty({
    description: 'When the API key was last updated',
    example: '2024-01-10T14:20:00Z',
  })
  updatedAt!: Date

  @ApiPropertyOptional({
    description: 'When the API key was revoked (null if active)',
    example: null,
  })
  revokedAt?: Date | null

  @ApiProperty({
    description: 'API key status',
    example: 'active',
    enum: ['active', 'revoked'],
  })
  status!: 'active' | 'revoked'
}

export class ApiKeyListResponseDto {
  @ApiProperty({
    description: 'List of API keys',
    type: [ApiKeyResponseDto],
  })
  data!: ApiKeyResponseDto[]

  @ApiProperty({
    description: 'Total number of API keys',
    example: 5,
  })
  total!: number

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  pageSize!: number

  @ApiProperty({
    description: 'Total number of pages',
    example: 1,
  })
  totalPages!: number
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    description: 'Full API key (only returned during creation)',
    example: 'ak_1234567890abcdef1234567890abcdef',
  })
  apiKey!: string
}
