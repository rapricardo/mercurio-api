import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceResponseDto {
  @ApiProperty({
    description: 'Workspace ID',
    example: '1',
  })
  id!: string;

  @ApiProperty({
    description: 'Parent tenant ID',
    example: '1',
  })
  tenantId!: string;

  @ApiProperty({
    description: 'Workspace name',
    example: 'Production Environment',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Workspace description',
    example: 'Main production environment for analytics',
  })
  description?: string;

  @ApiProperty({
    description: 'Workspace creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Workspace-specific settings and configurations',
    example: {
      theme: 'light',
      timezone: 'UTC',
      retentionDays: 365,
      features: ['events', 'analytics', 'funnels'],
    },
  })
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Environment type for the workspace',
    example: 'production',
  })
  environment?: string;

  @ApiPropertyOptional({
    description: 'Workspace-specific limits and quotas',
    example: {
      maxEventsPerMonth: 1000000,
      maxFunnels: 50,
      maxUsers: 25,
    },
  })
  limits?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Parent tenant information',
    example: {
      id: '1',
      name: 'Acme Corporation',
      status: 'active',
    },
  })
  tenant?: {
    id: string;
    name: string;
    status: string;
  };

  @ApiPropertyOptional({
    description: 'Workspace statistics and usage information',
    example: {
      totalEvents: 150000,
      totalUsers: 15,
      totalFunnels: 8,
      totalApiKeys: 2,
      lastActivity: '2024-01-20T14:25:00.000Z',
    },
  })
  stats?: {
    totalEvents: number;
    totalUsers: number;
    totalFunnels: number;
    totalApiKeys: number;
    lastActivity?: string;
  };
}

export class WorkspaceListResponseDto {
  @ApiProperty({
    description: 'Array of workspaces',
    type: [WorkspaceResponseDto],
  })
  data!: WorkspaceResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      total: 25,
      page: 1,
      pageSize: 20,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  })
  pagination!: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  @ApiProperty({
    description: 'Parent tenant information',
    example: {
      id: '1',
      name: 'Acme Corporation',
      status: 'active',
    },
  })
  tenant!: {
    id: string;
    name: string;
    status: string;
  };
}