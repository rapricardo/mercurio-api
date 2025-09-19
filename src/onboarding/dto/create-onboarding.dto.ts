import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator'

export class CreateOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  tenantName!: string

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  workspaceName!: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  tenantDescription?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  workspaceDescription?: string

  @IsString()
  @IsOptional()
  workspaceEnvironment?: 'development' | 'staging' | 'production'
}
