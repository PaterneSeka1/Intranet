import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateTabFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  // Cf. create-tab.dto.ts : clé du registre tab-icons.tsx, ou data URI 128x128 WebP/PNG.
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
}
