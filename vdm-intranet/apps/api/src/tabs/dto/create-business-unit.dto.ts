import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateBusinessUnitDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  code!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string
}
