import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class ReorderTabFolderItemDto {
  @IsString()
  id!: string

  @IsInt()
  order!: number
}

export class ReorderTabFoldersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderTabFolderItemDto)
  items!: ReorderTabFolderItemDto[]
}
