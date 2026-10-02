import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Matricule ou email du compte' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identifier!: string
}
