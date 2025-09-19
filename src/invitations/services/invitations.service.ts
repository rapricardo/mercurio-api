import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { MercurioLogger } from '../../common/services/logger.service'
import { MetricsService } from '../../common/services/metrics.service'
import { EmailService, InvitationData } from '../../common/services/email.service'
import { HybridTenantContext } from '../../common/auth/hybrid-auth.guard'
import { UserMappingService } from '../../common/auth/user-mapping.service'
import { SupabaseAdminService } from '../../common/auth/supabase-admin.service'
import { InviteStatus } from '@prisma/client'
import { CreateInvitationDto, AcceptInvitationDto } from '../dto'
import {
  InvitationResponseDto,
  PublicInvitationResponseDto,
  AcceptInvitationResponseDto,
} from '../dto'
import { nanoid } from 'nanoid'

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: MercurioLogger,
    private readonly metrics: MetricsService,
    private readonly emailService: EmailService,
    private readonly userMappingService: UserMappingService,
    private readonly supabaseAdminService: SupabaseAdminService
  ) {}

  async createInvitation(
    tenantId: string,
    dto: CreateInvitationDto,
    context: HybridTenantContext
  ): Promise<InvitationResponseDto> {
    const startTime = Date.now()

    try {
      const tenantIdBigInt = BigInt(tenantId)

      this.logger.log('Creating invitation', {
        tenantId,
        email: dto.email,
        role: dto.role,
        authType: context.authType,
        userId: context.userId,
      })

      // Validate permissions - only admin users can create invitations
      if (context.authType === 'supabase_jwt') {
        // For JWT users, check if they have admin access
        const hasAccess = await this.userMappingService.hasTenantAccess(
          context.userId!,
          tenantIdBigInt,
          'admin'
        )
        if (!hasAccess) {
          throw new ForbiddenException('Only admin users can create invitations')
        }
      } else if (context.authType !== 'api_key') {
        throw new ForbiddenException('Only authenticated users can create invitations')
      }
      // API keys have admin permissions by default

      // Check if tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
        select: { id: true, name: true, status: true },
      })

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`)
      }

      // Check if user is already invited or has access
      const existingInvitation = await this.prisma.invitation.findFirst({
        where: {
          email: dto.email.toLowerCase(),
          tenantId: tenantIdBigInt,
          workspaceId: context.workspaceId!,
          status: { in: [InviteStatus.PENDING, InviteStatus.ACCEPTED] },
        },
      })

      if (existingInvitation) {
        if (existingInvitation.status === InviteStatus.ACCEPTED) {
          throw new ConflictException(`User ${dto.email} already has access to this tenant`)
        }
        throw new ConflictException(`Invitation for ${dto.email} already exists and is pending`)
      }

      // Check if user already exists in Supabase - this is just informational
      // We allow inviting existing users, they will get an email to accept the invitation
      const userExists = await this.supabaseAdminService.checkUserExists(dto.email)
      if (userExists.error) {
        this.logger.warn('Could not check if user exists in Supabase', {
          email: dto.email,
          error: userExists.error,
        })
      }

      // Generate unique invitation token
      const token = `inv_${nanoid(32)}`

      // Set expiration date (30 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Verify creator exists (only for JWT users, API keys don't have user profiles)
      let createdBy = null
      if (context.authType === 'supabase_jwt' && context.userId) {
        createdBy = await this.prisma.userProfile.findUnique({
          where: { id: context.userId },
          select: { id: true, name: true, email: true },
        })

        if (!createdBy) {
          throw new NotFoundException('Creator user profile not found')
        }
      }

      // Create invitation
      const invitation = await this.prisma.invitation.create({
        data: {
          email: dto.email.toLowerCase(),
          role: dto.role,
          token,
          status: InviteStatus.PENDING,
          tenantId: tenantIdBigInt,
          workspaceId: context.workspaceId!,
          expiresAt,
          createdById: context.userId || null,
        },
        include: {
          tenant: {
            select: { id: true, name: true },
          },
          workspace: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      this.logger.log('Invitation created successfully', {
        invitationId: invitation.id.toString(),
        email: dto.email,
        token: token.substring(0, 6) + '...',
        tenantId,
      })

      // Emit invitation.created event
      const _eventData = {
        id: invitation.id.toString(),
        email: invitation.email,
        role: invitation.role as 'admin' | 'editor' | 'viewer',
        tenantId: invitation.tenantId.toString(),
        tenantName: invitation.tenant.name,
        workspaceId: invitation.workspaceId.toString(),
        workspaceName: invitation.workspace.name,
        token: invitation.token,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        createdBy: invitation.createdBy?.id || null,
      }

      this.logger.log('Emitting invitation.created event', {
        invitationId: invitation.id.toString(),
        tenantId,
      })

      // Send invitation email asynchronously to avoid blocking the HTTP response
      const baseUrl = process.env.INVITATION_BASE_URL || 'http://localhost:8020'
      const inviteLink = `${baseUrl}/accept-invite/${token}`

      const invitationData: InvitationData = {
        id: invitation.id.toString(),
        email: invitation.email,
        role: invitation.role as 'admin' | 'editor' | 'viewer',
        tenantName: invitation.tenant.name,
        workspaceName: invitation.workspace.name,
        inviterName: invitation.createdBy?.name || undefined,
        inviterEmail: invitation.createdBy?.email || 'API Key',
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      }

      // Send email in background to avoid blocking the request
      setImmediate(async () => {
        try {
          const emailResult = await this.emailService.sendInvitationEmail(
            invitationData,
            inviteLink,
            {
              tenantId,
              invitationId: invitation.id.toString(),
            }
          )

          if (!emailResult.success) {
            this.logger.warn('Failed to send invitation email', {
              invitationId: invitation.id.toString(),
              email: dto.email,
              error: emailResult.error,
            })
          } else {
            this.logger.log('Invitation email sent successfully', {
              invitationId: invitation.id.toString(),
              email: dto.email,
              messageId: emailResult.messageId,
            })
          }
        } catch (error) {
          this.logger.error(
            'Error sending invitation email in background',
            error instanceof Error ? error : new Error(String(error)),
            {
              invitationId: invitation.id.toString(),
              email: dto.email,
            }
          )
        }
      })

      // Record metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('invitation_create_processing_time', processingTime)
      this.metrics.incrementCounter('invitation_create_requests')

      return {
        id: invitation.id.toString(),
        email: invitation.email,
        role: invitation.role as 'admin' | 'editor' | 'viewer',
        status: invitation.status,
        token: invitation.token,
        tenant_id: invitation.tenantId.toString(),
        workspace_id: invitation.workspaceId.toString(),
        expires_at: invitation.expiresAt.toISOString(),
        created_at: invitation.createdAt.toISOString(),
        invited_by: invitation.createdBy?.email || 'API Key',
      }
    } catch (error) {
      this.logger.error(
        'Error creating invitation',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          email: dto.email,
        }
      )
      this.metrics.incrementCounter('invitation_create_errors')
      throw error
    }
  }

  async listInvitations(
    tenantId: string,
    context: HybridTenantContext
  ): Promise<InvitationResponseDto[]> {
    const startTime = Date.now()

    try {
      const tenantIdBigInt = BigInt(tenantId)

      this.logger.log('Listing invitations', {
        tenantId,
        authType: context.authType,
        userId: context.userId,
      })

      // Validate permissions - only admin users can list invitations
      if (context.authType === 'supabase_jwt') {
        // For JWT users, check if they have admin access
        const hasAccess = await this.userMappingService.hasTenantAccess(
          context.userId!,
          tenantIdBigInt,
          'admin'
        )
        if (!hasAccess) {
          throw new ForbiddenException('Only admin users can list invitations')
        }
      } else if (context.authType !== 'api_key') {
        throw new ForbiddenException('Only authenticated users can list invitations')
      }
      // API keys have admin permissions by default

      // Check if tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantIdBigInt },
      })

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`)
      }

      const invitations = await this.prisma.invitation.findMany({
        where: {
          tenantId: tenantIdBigInt,
          workspaceId: context.workspaceId!,
        },
        include: {
          tenant: {
            select: { id: true, name: true },
          },
          workspace: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Record metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('invitation_list_processing_time', processingTime)
      this.metrics.incrementCounter('invitation_list_requests')

      return invitations.map((invitation) => ({
        id: invitation.id.toString(),
        email: invitation.email,
        role: invitation.role as 'admin' | 'editor' | 'viewer',
        status: invitation.status,
        token: invitation.token,
        tenant_id: invitation.tenantId.toString(),
        workspace_id: invitation.workspaceId.toString(),
        expires_at: invitation.expiresAt.toISOString(),
        created_at: invitation.createdAt.toISOString(),
        invited_by: invitation.createdBy?.email || 'API Key',
      }))
    } catch (error) {
      this.logger.error(
        'Error listing invitations',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
        }
      )
      this.metrics.incrementCounter('invitation_list_errors')
      throw error
    }
  }

  async getInvitationByToken(token: string): Promise<PublicInvitationResponseDto> {
    const startTime = Date.now()

    try {
      this.logger.log('Getting invitation by token', { token: token.substring(0, 8) + '...' })

      const invitation = await this.prisma.invitation.findUnique({
        where: { token },
        include: {
          tenant: {
            select: { name: true },
          },
          workspace: {
            select: { name: true },
          },
        },
      })

      if (!invitation) {
        throw new NotFoundException('Invitation not found')
      }

      // Check if invitation is expired
      if (invitation.expiresAt < new Date()) {
        throw new BadRequestException('Invitation has expired')
      }

      // Check if invitation is already accepted or canceled
      if (invitation.status !== InviteStatus.PENDING) {
        throw new BadRequestException(
          `Invitation has already been ${invitation.status.toLowerCase()}`
        )
      }

      // Record metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('invitation_get_processing_time', processingTime)
      this.metrics.incrementCounter('invitation_get_requests')

      return {
        email: invitation.email,
        role: invitation.role as 'admin' | 'editor' | 'viewer',
        status: invitation.status,
        expires_at: invitation.expiresAt.toISOString(),
        tenant_name: invitation.tenant.name,
        workspace_name: invitation.workspace.name,
      }
    } catch (error) {
      this.logger.error(
        'Error getting invitation by token',
        error instanceof Error ? error : new Error(String(error)),
        {
          token: token.substring(0, 8) + '...',
        }
      )
      this.metrics.incrementCounter('invitation_get_errors')
      throw error
    }
  }

  async acceptInvitation(
    token: string,
    dto: AcceptInvitationDto
  ): Promise<AcceptInvitationResponseDto> {
    const startTime = Date.now()

    try {
      this.logger.log('Accepting invitation', {
        token: token.substring(0, 8) + '...',
        firstName: dto.first_name,
        lastName: dto.last_name,
      })

      const invitation = await this.prisma.invitation.findUnique({
        where: { token },
        include: {
          tenant: {
            select: { id: true, name: true },
          },
          workspace: {
            select: { id: true, name: true },
          },
        },
      })

      if (!invitation) {
        throw new NotFoundException('Invitation not found')
      }

      // Check if invitation is expired
      if (invitation.expiresAt < new Date()) {
        throw new BadRequestException('Invitation has expired')
      }

      // Check if invitation is still pending
      if (invitation.status !== InviteStatus.PENDING) {
        throw new BadRequestException(
          `Invitation has already been ${invitation.status.toLowerCase()}`
        )
      }

      // Check if user already exists in Supabase
      const userExists = await this.supabaseAdminService.checkUserExists(invitation.email)

      if (userExists.exists) {
        // User exists - they should have an account already, but we can still grant access
        this.logger.log('Accepting invitation for existing user', {
          email: invitation.email,
          userId: userExists.userId,
          invitationId: invitation.id.toString(),
        })

        // For existing users, we need to handle this differently
        // Grant workspace access directly without creating a new user
        const result = await this.prisma.$transaction(async (tx) => {
          // Ensure user profile exists in our database
          const profileCreated = await this.userMappingService.createUserProfile(
            {
              id: userExists.userId!,
              email: invitation.email,
              name: `${dto.first_name} ${dto.last_name}`,
              user_metadata: {
                firstName: dto.first_name,
                lastName: dto.last_name,
              },
            },
            tx
          )

          if (!profileCreated) {
            throw new BadRequestException('Failed to create/update user profile')
          }

          // Grant workspace access
          const accessGranted = await this.userMappingService.grantWorkspaceAccess(
            userExists.userId!,
            invitation.tenantId,
            invitation.workspaceId,
            invitation.role,
            invitation.createdById || undefined,
            tx
          )

          if (!accessGranted) {
            throw new BadRequestException('Failed to grant workspace access')
          }

          // Update invitation status
          const updatedInvitation = await tx.invitation.update({
            where: { id: invitation.id },
            data: {
              status: InviteStatus.ACCEPTED,
              acceptedById: userExists.userId!,
            },
          })

          return { userId: userExists.userId!, updatedInvitation }
        })

        // Invalidate user cache after successful transaction
        this.userMappingService.invalidateUser(result.userId)

        this.logger.log('Invitation accepted successfully for existing user', {
          invitationId: invitation.id.toString(),
          userId: result.userId,
          email: invitation.email,
          tenantId: invitation.tenantId.toString(),
        })

        // Record metrics
        const processingTime = Date.now() - startTime
        this.metrics.recordLatency('invitation_accept_processing_time', processingTime)
        this.metrics.incrementCounter('invitation_accept_requests')

        return {
          accessToken: '', // Existing users should log in separately
        }
      }

      // Create new user in Supabase with transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user in Supabase
        const createUserResult = await this.supabaseAdminService.createUser(
          invitation.email,
          dto.password,
          {
            firstName: dto.first_name,
            lastName: dto.last_name,
          }
        )

        if (!createUserResult.success) {
          this.logger.error(
            'Failed to create user in Supabase during invitation acceptance',
            undefined,
            {
              email: invitation.email,
              invitationId: invitation.id.toString(),
              error: createUserResult.error,
            }
          )
          throw new BadRequestException(`Failed to create user account: ${createUserResult.error}`)
        }

        if (!createUserResult.userId) {
          this.logger.error('No userId returned from Supabase user creation', undefined, {
            email: invitation.email,
            invitationId: invitation.id.toString(),
          })
          throw new BadRequestException('Failed to create user account: No user ID returned')
        }

        const userId = createUserResult.userId

        // Create user profile in our database (within transaction)
        const profileCreated = await this.userMappingService.createUserProfile(
          {
            id: userId,
            email: invitation.email,
            name: `${dto.first_name} ${dto.last_name}`,
            user_metadata: {
              firstName: dto.first_name,
              lastName: dto.last_name,
            },
          },
          tx
        )

        if (!profileCreated) {
          this.logger.error('Failed to create user profile in database', undefined, {
            userId,
            email: invitation.email,
            invitationId: invitation.id.toString(),
          })
          throw new BadRequestException('Failed to create user profile')
        }

        this.logger.debug('User profile created successfully', {
          userId,
          email: invitation.email,
          invitationId: invitation.id.toString(),
        })

        // Grant workspace access (within transaction)
        const accessGranted = await this.userMappingService.grantWorkspaceAccess(
          userId,
          invitation.tenantId,
          invitation.workspaceId,
          invitation.role,
          invitation.createdById || undefined,
          tx
        )

        if (!accessGranted) {
          this.logger.error('Failed to grant workspace access', undefined, {
            userId,
            tenantId: invitation.tenantId.toString(),
            workspaceId: invitation.workspaceId.toString(),
            role: invitation.role,
            invitationId: invitation.id.toString(),
          })
          throw new BadRequestException('Failed to grant workspace access')
        }

        this.logger.debug('Workspace access granted successfully', {
          userId,
          tenantId: invitation.tenantId.toString(),
          workspaceId: invitation.workspaceId.toString(),
          role: invitation.role,
          invitationId: invitation.id.toString(),
        })

        // Update invitation status
        const updatedInvitation = await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: InviteStatus.ACCEPTED,
            acceptedById: userId,
          },
        })

        return { userId, updatedInvitation }
      })

      // Invalidate user cache after successful transaction
      this.userMappingService.invalidateUser(result.userId)

      // Generate access token by signing in the user with their credentials
      const accessToken = await this.supabaseAdminService.signInUser(invitation.email, dto.password)

      if (!accessToken) {
        this.logger.warn('Failed to generate access token for new user', {
          userId: result.userId,
          email: invitation.email,
          invitationId: invitation.id.toString(),
        })
      }

      this.logger.log('Invitation accepted successfully', {
        invitationId: invitation.id.toString(),
        userId: result.userId,
        email: invitation.email,
        tenantId: invitation.tenantId.toString(),
      })

      // Record metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('invitation_accept_processing_time', processingTime)
      this.metrics.incrementCounter('invitation_accept_requests')

      return {
        accessToken: accessToken || '',
      }
    } catch (error) {
      this.logger.error(
        'Error accepting invitation',
        error instanceof Error ? error : new Error(String(error)),
        {
          token: token.substring(0, 8) + '...',
        }
      )
      this.metrics.incrementCounter('invitation_accept_errors')

      // If we have a specific database/transaction error, provide better context
      if (error instanceof Error) {
        if (
          error.message.includes('unique constraint') ||
          error.message.includes('already exists')
        ) {
          throw new ConflictException(
            'User account or workspace access already exists. Please try logging in instead.'
          )
        }
        if (error.message.includes('transaction')) {
          throw new BadRequestException(
            'Failed to complete invitation acceptance. Please try again.'
          )
        }
      }

      throw error
    }
  }

  async revokeInvitation(
    tenantId: string,
    invitationId: string,
    context: HybridTenantContext
  ): Promise<{ message: string }> {
    const startTime = Date.now()

    try {
      const tenantIdBigInt = BigInt(tenantId)
      const invitationIdBigInt = BigInt(invitationId)

      this.logger.log('Revoking invitation', {
        tenantId,
        invitationId,
        authType: context.authType,
        userId: context.userId,
      })

      // Validate permissions - only admin users can revoke invitations
      if (context.authType === 'supabase_jwt') {
        // For JWT users, check if they have admin access
        const hasAccess = await this.userMappingService.hasTenantAccess(
          context.userId!,
          tenantIdBigInt,
          'admin'
        )
        if (!hasAccess) {
          throw new ForbiddenException('Only admin users can revoke invitations')
        }
      } else if (context.authType !== 'api_key') {
        throw new ForbiddenException('Only authenticated users can revoke invitations')
      }
      // API keys have admin permissions by default

      const invitation = await this.prisma.invitation.findUnique({
        where: { id: invitationIdBigInt },
      })

      if (!invitation) {
        throw new NotFoundException(`Invitation with ID ${invitationId} not found`)
      }

      // Verify invitation belongs to the specified tenant and workspace
      if (
        invitation.tenantId !== tenantIdBigInt ||
        invitation.workspaceId !== context.workspaceId!
      ) {
        throw new NotFoundException(
          `Invitation with ID ${invitationId} not found in the specified tenant and workspace`
        )
      }

      // Can only revoke pending invitations
      if (invitation.status !== InviteStatus.PENDING) {
        throw new BadRequestException(
          `Cannot revoke invitation that is already ${invitation.status.toLowerCase()}`
        )
      }

      // Update invitation status
      await this.prisma.invitation.update({
        where: { id: invitationIdBigInt },
        data: {
          status: InviteStatus.CANCELED,
        },
      })

      this.logger.log('Invitation revoked successfully', {
        invitationId,
        email: invitation.email,
        tenantId,
        revokedBy: context.userId,
      })

      // Record metrics
      const processingTime = Date.now() - startTime
      this.metrics.recordLatency('invitation_revoke_processing_time', processingTime)
      this.metrics.incrementCounter('invitation_revoke_requests')

      return {
        message: `Invitation for ${invitation.email} revoked successfully`,
      }
    } catch (error) {
      this.logger.error(
        'Error revoking invitation',
        error instanceof Error ? error : new Error(String(error)),
        {
          tenantId,
          invitationId,
        }
      )
      this.metrics.incrementCounter('invitation_revoke_errors')
      throw error
    }
  }
}
