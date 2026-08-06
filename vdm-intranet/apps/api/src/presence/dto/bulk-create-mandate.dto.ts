import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

/** Un jour du lot : mêmes champs qu'un mandat unitaire, sans userId (porté par le parent). */
export class BulkMandateDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime!: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedDepartureTime must be HH:mm' })
  expectedDepartureTime?: string

  @IsBoolean()
  @IsOptional()
  isNightShift?: boolean

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string
}

/**
 * Création/mise à jour en masse de mandats pour UN employé sur plusieurs dates (ex: peindre un
 * mois entier de rotation jour/nuit/week-end depuis le calendrier de planification).
 * Chaque jour est traité comme un upsert côté service : rejouer ce payload sur un mois déjà
 * partiellement rempli remplace les mandats existants aux dates concernées, sans erreur de
 * contrainte unique.
 */
export class BulkCreateMandateDto {
  @IsString()
  @IsNotEmpty()
  userId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(62) // marge confortable pour un mois affiché avec jours limitrophes ; garde-fou anti-abus
  @ValidateNested({ each: true })
  @Type(() => BulkMandateDayDto)
  days!: BulkMandateDayDto[]
}
