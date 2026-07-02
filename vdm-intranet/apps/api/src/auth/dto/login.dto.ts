import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'CTO' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username!: string

  @ApiProperty({ example: 'MotDePasse8+' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string
}
