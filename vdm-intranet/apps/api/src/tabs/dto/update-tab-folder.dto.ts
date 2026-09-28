import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateTabFolderDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(60000)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string

  // Audience : global (visible par tous) ou liste des BU concernées, toutes au même niveau ;
  // les onglets du dossier en héritent.
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
