import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'
import { HybridAuthGuard, HybridTenantContext } from '../../common/auth/hybrid-auth.guard'
import { InvitationsService } from '../services/invitations.service'
import {
  CreateInvitationDto,
  AcceptInvitationDto,
  InvitationResponseDto,
  PublicInvitationResponseDto,
  AcceptInvitationResponseDto,
} from '../dto'

@ApiTags('Invitations')
@Controller('v1')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create invitation (DEPRECATED)',
    description:
      'Create a new invitation to invite a user to join a tenant. Only admin users can create invitations. DEPRECATED: Use workspace-scoped route instead.',
    deprecated: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can create invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already invited or has access',
  })
  async createInvitation(
    @Body() createInvitationDto: CreateInvitationDto,
    @Req() request: FastifyRequest
  ): Promise<InvitationResponseDto> {
    const context = request.tenantContext as HybridTenantContext
    return this.invitationsService.createInvitation(
      context.tenantId!.toString(),
      createInvitationDto,
      context
    )
  }

  @Get('invitations')
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'List invitations (DEPRECATED)',
    description:
      'List all invitations for the tenant. Only admin users can list invitations. DEPRECATED: Use workspace-scoped route instead.',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
    type: [InvitationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can list invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  async listInvitations(@Req() request: FastifyRequest): Promise<InvitationResponseDto[]> {
    const context = request.tenantContext as HybridTenantContext
    return this.invitationsService.listInvitations(context.tenantId!.toString(), context)
  }

  @Get('invitations/:token')
  @ApiOperation({
    summary: 'Get invitation by token (Public)',
    description:
      'Get public invitation details by token. This endpoint is public and does not require authentication. Used by invited users to view invitation details before accepting.',
  })
  @ApiParam({
    name: 'token',
    type: 'string',
    description: 'Invitation token',
    example: 'inv_abcd1234efgh5678ijkl9012mnop3456',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation details retrieved successfully',
    type: PublicInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invitation expired or invalid status',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  async getInvitationByToken(@Param('token') token: string): Promise<PublicInvitationResponseDto> {
    return this.invitationsService.getInvitationByToken(token)
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept invitation (Public)',
    description:
      'Accept an invitation and create a new user account. This endpoint is public and does not require authentication. Creates the user in Supabase and grants workspace access.',
  })
  @ApiParam({
    name: 'token',
    type: 'string',
    description: 'Invitation token',
    example: 'inv_abcd1234efgh5678ijkl9012mnop3456',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: AcceptInvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input, invitation expired, or user creation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
  })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() acceptInvitationDto: AcceptInvitationDto
  ): Promise<AcceptInvitationResponseDto> {
    return this.invitationsService.acceptInvitation(token, acceptInvitationDto)
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Revoke invitation (DEPRECATED)',
    description:
      'Revoke a pending invitation. Only admin users can revoke invitations. Only pending invitations can be revoked. DEPRECATED: Use workspace-scoped route instead.',
    deprecated: true,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Invitation ID',
    example: '1',
  })
  @ApiResponse({
    status: 204,
    description: 'Invitation revoked successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invitation already accepted or canceled',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can revoke invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation, workspace, or tenant not found',
  })
  async revokeInvitation(
    @Param('id') invitationId: string,
    @Req() request: FastifyRequest
  ): Promise<void> {
    const context = request.tenantContext as HybridTenantContext
    await this.invitationsService.revokeInvitation(
      context.tenantId!.toString(),
      invitationId,
      context
    )
  }

  // ========================================
  // WORKSPACE-SCOPED ROUTES (PREFERRED)
  // ========================================

  @Post('workspaces/:workspaceId/invitations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create invitation (Workspace-scoped)',
    description:
      'Create a new invitation to invite a user to join a specific workspace. Only admin users can create invitations.',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: 'ws_1',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data or workspace ID mismatch',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can create invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already invited or has access',
  })
  async createWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Body() createInvitationDto: CreateInvitationDto,
    @Req() request: FastifyRequest
  ): Promise<InvitationResponseDto> {
    const context = request.tenantContext as HybridTenantContext

    // Validate that the workspace ID in the URL matches the context
    if (context.workspaceId!.toString() !== workspaceId) {
      throw new BadRequestException(
        'Workspace ID in URL does not match authenticated workspace context'
      )
    }

    return this.invitationsService.createInvitation(
      context.tenantId!.toString(),
      createInvitationDto,
      context
    )
  }

  @Get('workspaces/:workspaceId/invitations')
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'List invitations (Workspace-scoped)',
    description:
      'List all invitations for a specific workspace. Only admin users can list invitations.',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: 'ws_1',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
    type: [InvitationResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Workspace ID mismatch',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can list invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace or tenant not found',
  })
  async listWorkspaceInvitations(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<InvitationResponseDto[]> {
    const context = request.tenantContext as HybridTenantContext

    // Validate that the workspace ID in the URL matches the context
    if (context.workspaceId!.toString() !== workspaceId) {
      throw new BadRequestException(
        'Workspace ID in URL does not match authenticated workspace context'
      )
    }

    return this.invitationsService.listInvitations(context.tenantId!.toString(), context)
  }

  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(HybridAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Revoke invitation (Workspace-scoped)',
    description:
      'Revoke a pending invitation for a specific workspace. Only admin users can revoke invitations. Only pending invitations can be revoked.',
  })
  @ApiParam({
    name: 'workspaceId',
    type: 'string',
    description: 'Workspace ID',
    example: 'ws_1',
  })
  @ApiParam({
    name: 'invitationId',
    type: 'string',
    description: 'Invitation ID',
    example: '1',
  })
  @ApiResponse({
    status: 204,
    description: 'Invitation revoked successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invitation already accepted/canceled or workspace ID mismatch',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admin users can revoke invitations',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation, workspace, or tenant not found',
  })
  async revokeWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: FastifyRequest
  ): Promise<void> {
    const context = request.tenantContext as HybridTenantContext

    // Validate that the workspace ID in the URL matches the context
    if (context.workspaceId!.toString() !== workspaceId) {
      throw new BadRequestException(
        'Workspace ID in URL does not match authenticated workspace context'
      )
    }

    await this.invitationsService.revokeInvitation(
      context.tenantId!.toString(),
      invitationId,
      context
    )
  }
}
