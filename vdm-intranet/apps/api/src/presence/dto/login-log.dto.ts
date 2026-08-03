import { IsNumber, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator'

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

  // Pas de champ mapsUrl : construit uniquement côté serveur (buildMapsUrl) à partir
  // de latitude/longitude, jamais fait confiance à une valeur fournie par le client.

  @IsString()
  @MaxLength(300)
  @IsOptional()
  userAgent?: string
}
