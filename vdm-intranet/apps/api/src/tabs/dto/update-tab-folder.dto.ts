import { IsOptional, IsString, MaxLength } from 'class-validator'

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
}
