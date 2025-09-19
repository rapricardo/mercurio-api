import { IsNotEmpty, IsEmail, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Must be a valid email address' })
  email!: string

  @ApiProperty({
    description: 'Role to assign to the invited user',
    example: 'editor',
    enum: ['admin', 'editor', 'viewer'],
  })
  @IsNotEmpty()
  @IsIn(['admin', 'editor', 'viewer'], { message: 'Role must be admin, editor, or viewer' })
  role!: 'admin' | 'editor' | 'viewer'
}
