import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TenantResponseDto {
  @ApiProperty({
    description: 'Tenant ID',
    example: '1',
  })
  id!: string

  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
  })
  name!: string

  @ApiProperty({
    description: 'Tenant status',
    example: 'active',
    enum: ['active', 'inactive', 'suspended'],
  })
  status!: string

  @ApiProperty({
    description: 'Tenant creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string

  @ApiPropertyOptional({
    description: 'Tenant-specific settings and configurations',
    example: {
      theme: 'light',
      timezone: 'UTC',
      features: ['analytics', 'funnels'],
    },
  })
  settings?: Record<string, any>

  @ApiPropertyOptional({
    description: 'Subscription plan identifier',
    example: 'pro',
  })
  plan?: string

  @ApiPropertyOptional({
    description: 'Tenant-specific limits and quotas',
    example: {
      maxUsers: 100,
      maxWorkspaces: 10,
      maxEventsPerMonth: 1000000,
    },
  })
  limits?: Record<string, any>

  @ApiPropertyOptional({
    description: 'Tenant statistics and usage information',
    example: {
      totalWorkspaces: 3,
      totalUsers: 25,
      totalEvents: 50000,
      lastActivity: '2024-01-20T14:25:00.000Z',
    },
  })
  stats?: {
    totalWorkspaces: number
    totalUsers: number
    totalEvents: number
    lastActivity?: string
  }
}

export class TenantListResponseDto {
  @ApiProperty({
    description: 'Array of tenants',
    type: [TenantResponseDto],
  })
  data!: TenantResponseDto[]

  @ApiProperty({
    description: 'Pagination information',
    example: {
      total: 150,
      page: 1,
      pageSize: 20,
      totalPages: 8,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  })
  pagination!: {
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}
