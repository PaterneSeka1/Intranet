import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de réinitialisation reçu par email' })
  @IsString()
  @IsNotEmpty()
  token!: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string
}
