import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class UpsertWorkplaceLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

  // Rayon de tolérance en mètres avant de considérer une connexion comme "hors site" (marge
  // d'imprécision GPS incluse). 150m par défaut si non fourni.
  @IsInt()
  @IsOptional()
  @Min(10)
  @Max(5000)
  radiusMeters?: number
}
