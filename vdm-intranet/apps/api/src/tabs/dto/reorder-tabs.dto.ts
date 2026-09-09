import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * Un onglet repositionné : `order` n'est significatif qu'au sein du même `folderId` (voir
 * PortalTab.order dans schema.prisma). `folderId` absent = onglet non déplacé (garde son dossier
 * actuel) ; `folderId: null` = retiré de tout dossier (@IsOptional laisse passer null sans
 * exiger IsString, cf. class-validator).
 */
export class ReorderTabItemDto {
  @IsString()
  id!: string

  @IsOptional()
  @IsString()
  folderId?: string | null

  @IsInt()
  order!: number
}

export class ReorderTabsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReorderTabItemDto)
  items!: ReorderTabItemDto[]
}
