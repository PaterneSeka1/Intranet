import { IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, Max } from 'class-validator'

export class LoginLogDto {
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50000)
  accuracy?: number

  @IsString()
  @MaxLength(500)
  @IsOptional()
  address?: string

  @IsUrl({ protocols: ['https'], require_tld: false })
  @MaxLength(500)
  @IsOptional()
  mapsUrl?: string

  @IsString()
  @MaxLength(300)
  @IsOptional()
  userAgent?: string
}
