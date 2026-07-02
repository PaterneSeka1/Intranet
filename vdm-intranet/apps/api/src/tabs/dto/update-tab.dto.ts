import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'

export class UpdateTabDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string

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
  @IsBoolean()
  isActive?: boolean
}
