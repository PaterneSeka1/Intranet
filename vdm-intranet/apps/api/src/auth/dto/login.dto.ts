import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({
    example: 'EMP-0231',
    description: 'Matricule (employés) ou email (stagiaires, qui n’ont pas de matricule).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identifier!: string

  @ApiProperty({ example: 'MotDePasse8+' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string
}
