import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class CreateTabDto {
  @IsString()
  name!: string

  @IsUrl({ require_tld: false })
  url!: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string

  @IsOptional()
  @IsString()
  businessUnitId?: string
}
