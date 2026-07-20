import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Identifiant ou email du compte' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identifier!: string
}
