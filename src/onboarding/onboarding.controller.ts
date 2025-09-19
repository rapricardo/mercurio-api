import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
  Logger,
  Headers,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { SupabaseAuthService } from '../common/auth/supabase-auth.service'
import { CreateOnboardingDto } from './dto/create-onboarding.dto'
import { OnboardingResponseDto } from './dto/onboarding-response.dto'
import { OnboardingEligibilityDto } from '../common/auth/dto/user-status.dto'

@Controller('v1/onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name)

  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly supabaseAuthService: SupabaseAuthService
  ) {}

  @Get('eligibility')
  async checkOnboardingEligibility(
    @Headers('authorization') authHeader?: string
  ): Promise<OnboardingEligibilityDto> {
    this.logger.log('🔍 Checking onboarding eligibility')

    // Validate JWT
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)
    const validation = await this.supabaseAuthService.validateJWT(token)

    if (!validation.isValid || !validation.user) {
      throw new UnauthorizedException(validation.error || 'Invalid JWT token')
    }

    try {
      // Check if user already has workspace access
      const hasExistingAccess = await this.onboardingService.hasExistingAccess(validation.user.id)

      if (hasExistingAccess) {
        this.logger.log('✅ User already has workspace access', { userId: validation.user.id })

        return {
          eligible: false,
          reason: 'User already has workspace access',
          nextAction: 'dashboard',
          context: {
            canCreateAdditionalWorkspace: true, // Could be configurable per plan
          },
        }
      }

      this.logger.log('✅ User is eligible for onboarding', { userId: validation.user.id })

      return {
        eligible: true,
        reason: 'User has no workspace access and can proceed with onboarding',
        nextAction: 'onboard',
        context: {
          existingWorkspaceCount: 0,
        },
      }
    } catch (error) {
      this.logger.error('❌ Error checking onboarding eligibility', {
        userId: validation.user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Return safe response in case of database errors
      return {
        eligible: true,
        reason: 'Unable to verify existing access, allowing onboarding attempt',
        nextAction: 'onboard',
        context: {
          existingWorkspaceCount: 0,
        },
      }
    }
  }

  @Post()
  async createTenantAndWorkspace(
    @Body() dto: CreateOnboardingDto,
    @Headers('authorization') authHeader?: string
  ): Promise<OnboardingResponseDto> {
    this.logger.log('🚀 Onboarding request received', {
      tenantName: dto.tenantName,
      workspaceName: dto.workspaceName,
      hasAuthHeader: !!authHeader,
    })

    // Basic JWT validation without workspace access checks
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)
    const validation = await this.supabaseAuthService.validateJWT(token)

    if (!validation.isValid || !validation.user) {
      this.logger.warn('🚨 JWT validation failed for onboarding', {
        error: validation.error,
      })
      throw new UnauthorizedException(validation.error || 'Invalid JWT token')
    }

    this.logger.log('✅ JWT validation successful for onboarding', {
      userId: validation.user.id,
      userEmail: validation.user.email,
    })

    // Create tenant and workspace with auto-grant in single transaction
    try {
      const result = await this.onboardingService.createTenantAndWorkspace(dto, validation.user)

      this.logger.log('🎉 Onboarding completed successfully', {
        userId: validation.user.id,
        tenantId: result.tenant.id,
        workspaceId: result.workspace.id,
      })

      return result
    } catch (error) {
      this.logger.error('❌ Controller: Onboarding failed', {
        userId: validation.user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name,
      })

      // Handle ConflictException from service (already properly mapped)
      if (error instanceof ConflictException) {
        throw error
      }

      // Handle Prisma validation errors that might escape the service
      if ((error as any)?.code?.startsWith('P20')) {
        this.logger.warn('Prisma error escaped service layer', {
          code: (error as any).code,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
        throw new BadRequestException(
          'Invalid data provided. Please check your input and try again.'
        )
      }

      // Handle any other unexpected errors
      this.logger.error('Unexpected error in onboarding', {
        error: error instanceof Error ? error.stack : error,
        userId: validation.user.id,
      })

      throw new InternalServerErrorException(
        'An unexpected error occurred during onboarding. Please try again or contact support.'
      )
    }
  }
}
