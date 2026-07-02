import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateAnnouncementDto {
  @IsString() @IsOptional() @MaxLength(200)
  title?: string

  @IsString() @IsOptional() @MaxLength(5000)
  body?: string

  @IsString() @IsOptional()
  businessUnitId?: string | null

  @IsBoolean() @IsOptional()
  isPinned?: boolean

  @IsBoolean() @IsOptional()
  isActive?: boolean

  @IsDateString() @IsOptional()
  publishedAt?: string

  @IsDateString() @IsOptional()
  expiresAt?: string | null
}
