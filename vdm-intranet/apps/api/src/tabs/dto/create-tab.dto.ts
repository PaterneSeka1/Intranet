import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'

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

  // Data URI d'une image 128x128 (WebP q0.9, repli PNG côté client — TabsManager.tsx) : ~60 000
  // caractères couvrent largement ce format, contre 100 000 précédemment (hors de toute proportion
  // avec name/description/color ci-dessus).
  @IsOptional()
  @IsString()
  @MaxLength(60000)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string

  @IsOptional()
  @IsString()
  businessUnitId?: string

  // Dossier de regroupement, doit être de la même portée (globale ou même BU) que l'onglet.
  @IsOptional()
  @IsString()
  folderId?: string

  // BU supplémentaires qui voient aussi l'onglet (onglet commun à plusieurs BU) — réservé aux
  // gestionnaires globaux, cf. TabsService.resolveSharedBuIds.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  sharedBusinessUnitIds?: string[]
}
