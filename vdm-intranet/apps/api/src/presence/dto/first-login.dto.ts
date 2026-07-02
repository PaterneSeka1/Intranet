import { IsNumber, IsOptional, IsString, MaxLength, Min, Max, IsNotEmpty } from 'class-validator'

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
  @MaxLength(500)
  @IsOptional()
  address?: string

  @IsString()
  @MaxLength(300)
  @IsOptional()
  userAgent?: string
}
