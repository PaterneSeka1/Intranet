import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'

export class LoginDto {
  @ApiProperty({
    example: 'EMP-0231',
    description: 'Matricule (employés) ou email (stagiaires, qui n’ont pas de matricule).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
