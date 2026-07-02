import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'CTO' })
  @IsString()
  @IsNotEmpty()
  username!: string

  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  password!: string
}
