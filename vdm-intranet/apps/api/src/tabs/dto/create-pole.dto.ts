import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'

export class CreatePoleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  code!: string

  @ApiProperty()
  @IsString()
  businessUnitId!: string
}
