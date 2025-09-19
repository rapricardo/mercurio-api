import { ApiProperty } from '@nestjs/swagger'
import { InviteStatus } from '@prisma/client'

export class InvitationResponseDto {
  @ApiProperty({
    description: 'Invitation ID',
    example: 'inv_1',
  })
  id!: string

  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'user@example.com',
  })
  email!: string

  @ApiProperty({
    description: 'Role assigned to the invited user',
    example: 'editor',
    enum: ['admin', 'editor', 'viewer'],
  })
  role!: 'admin' | 'editor' | 'viewer'

  @ApiProperty({
    description: 'Current status of the invitation',
    example: 'PENDING',
    enum: InviteStatus,
  })
  status!: InviteStatus

  @ApiProperty({
    description: 'Invitation token for acceptance',
    example: 'tkn_abcd1234efgh5678',
  })
  token!: string

  @ApiProperty({
    description: 'Tenant ID associated with the invitation',
    example: 'tn_1',
  })
  tenant_id!: string

  @ApiProperty({
    description: 'Workspace ID associated with the invitation',
    example: 'ws_1',
  })
  workspace_id!: string

  @ApiProperty({
    description: 'Invitation expiration timestamp',
    example: '2024-02-15T10:30:00.000Z',
  })
  expires_at!: string

  @ApiProperty({
    description: 'Invitation creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at!: string

  @ApiProperty({
    description: 'Email of the user who created the invitation',
    example: 'admin@example.com',
  })
  invited_by!: string
}

export class PublicInvitationResponseDto {
  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'user@example.com',
  })
  email!: string

  @ApiProperty({
    description: 'Role assigned to the invited user',
    example: 'editor',
    enum: ['admin', 'editor', 'viewer'],
  })
  role!: 'admin' | 'editor' | 'viewer'

  @ApiProperty({
    description: 'Current status of the invitation',
    example: 'PENDING',
    enum: InviteStatus,
  })
  status!: InviteStatus

  @ApiProperty({
    description: 'Invitation expiration timestamp',
    example: '2024-02-15T10:30:00.000Z',
  })
  expires_at!: string

  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
  })
  tenant_name!: string

  @ApiProperty({
    description: 'Workspace name',
    example: 'Production Website',
  })
  workspace_name!: string
}

export class AcceptInvitationResponseDto {
  @ApiProperty({
    description: 'Supabase access token for the new user',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string
}
