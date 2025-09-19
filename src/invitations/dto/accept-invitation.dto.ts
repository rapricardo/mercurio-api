import { IsNotEmpty, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'First name cannot be empty' })
  first_name!: string

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Doe',
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'Last name cannot be empty' })
  last_name!: string

  @ApiProperty({
    description: 'Password for the new user account',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string
}
