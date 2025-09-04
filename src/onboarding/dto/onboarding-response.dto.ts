export interface OnboardingTenantDto {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface OnboardingWorkspaceDto {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface OnboardingUserAccessDto {
  tenantId: string;
  workspaceId: string;
  role: string;
  grantedAt: string;
}

export interface OnboardingResponseDto {
  tenant: OnboardingTenantDto;
  workspace: OnboardingWorkspaceDto;
  userAccess: OnboardingUserAccessDto;
  message: string;
}