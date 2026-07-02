import { IsNumber, IsOptional, IsString, Min, Max, IsNotEmpty } from 'class-validator'

export class FirstLoginDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

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
