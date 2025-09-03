import { Controller, Post, Body, UnauthorizedException, Logger, Headers } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { SupabaseAuthService } from '../common/auth/supabase-auth.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { OnboardingResponseDto } from './dto/onboarding-response.dto';

@Controller('v1/onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  @Post()
  async createTenantAndWorkspace(
    @Body() dto: CreateOnboardingDto,
    @Headers('authorization') authHeader?: string
  ): Promise<OnboardingResponseDto> {
    this.logger.log('🚀 Onboarding request received', {
      tenantName: dto.tenantName,
      workspaceName: dto.workspaceName,
      hasAuthHeader: !!authHeader
    });

    // Basic JWT validation without workspace access checks
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const validation = await this.supabaseAuthService.validateJWT(token);

    if (!validation.isValid || !validation.user) {
      this.logger.warn('🚨 JWT validation failed for onboarding', {
        error: validation.error
      });
      throw new UnauthorizedException(validation.error || 'Invalid JWT token');
    }

    this.logger.log('✅ JWT validation successful for onboarding', {
      userId: validation.user.id,
      userEmail: validation.user.email
    });

    // Create tenant and workspace with auto-grant in single transaction
    const result = await this.onboardingService.createTenantAndWorkspace(dto, validation.user);

    this.logger.log('🎉 Onboarding completed successfully', {
      userId: validation.user.id,
      tenantId: result.tenant.id,
      workspaceId: result.workspace.id
    });

    return result;
  }
}