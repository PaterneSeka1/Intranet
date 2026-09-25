import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

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

  // BU supplémentaires qui voient aussi le dossier et ses onglets — réservé aux gestionnaires
  // globaux, cf. TabsService.resolveSharedBuIds. [] = retire tous les partages.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  sharedBusinessUnitIds?: string[]
}
