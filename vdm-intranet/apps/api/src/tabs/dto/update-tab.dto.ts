import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'

export class UpdateTabDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  // Cf. create-tab.dto.ts : data URI 128x128 WebP/PNG, ~60 000 caractères suffisent largement.
  @IsOptional()
  @IsString()
  @MaxLength(60000)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  // Dossier de regroupement ; null = retire l'onglet de son dossier (il garde alors l'audience
  // du dossier quitté). Rangé dans un dossier, l'onglet hérite de l'audience du dossier.
  @IsOptional()
  @IsString()
  folderId?: string | null

  // Audience (onglet hors dossier seulement) : global (visible par tous) ou liste des BU concernées, toutes au même niveau.
  // Modifiable par les seuls gestionnaires globaux (cf. TabsService.resolveAudienceChange).
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  businessUnitIds?: string[]
}
