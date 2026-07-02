import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator'

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
  accuracy?: number

  @IsString()
  @IsOptional()
  address?: string

  @IsString()
  @IsOptional()
  mapsUrl?: string

  @IsString()
  @IsOptional()
  userAgent?: string
}
