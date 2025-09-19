/**
 * User Status DTOs for onboarding eligibility and workspace information
 */

export interface UserStatusDto {
  /**
   * Whether the user needs to go through onboarding process
   */
  needsOnboarding: boolean

  /**
   * Whether the user has any workspace access
   */
  hasWorkspaces: boolean

  /**
   * Total number of workspaces the user has access to
   */
  workspaceCount: number

  /**
   * Primary workspace information (usually the first/most recent one)
   */
  primaryWorkspace?: PrimaryWorkspaceDto

  /**
   * User authentication status
   */
  authStatus: 'authenticated' | 'api_key'

  /**
   * User basic information
   */
  user?: {
    id: string
    email: string
    name?: string
    lastLoginAt?: string
  }
}

export interface PrimaryWorkspaceDto {
  /**
   * Tenant ID as string
   */
  tenantId: string

  /**
   * Workspace ID as string
   */
  workspaceId: string

  /**
   * Human-readable tenant name
   */
  tenantName: string

  /**
   * Human-readable workspace name
   */
  workspaceName: string

  /**
   * User's role in this workspace
   */
  role: string

  /**
   * When access was granted
   */
  grantedAt: string
}

export interface OnboardingEligibilityDto {
  /**
   * Whether user is eligible for onboarding
   */
  eligible: boolean

  /**
   * Reason why user is or isn't eligible
   */
  reason: string

  /**
   * Suggested next action
   */
  nextAction: 'onboard' | 'dashboard' | 'contact_support'

  /**
   * Additional context for frontend
   */
  context?: {
    existingWorkspaceCount?: number
    canCreateAdditionalWorkspace?: boolean
  }
}
