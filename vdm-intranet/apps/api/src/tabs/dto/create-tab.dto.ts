import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class CreateTabDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsUrl({ require_tld: false })
  url!: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string

  @IsOptional()
  @IsString()
  businessUnitId?: string
}
