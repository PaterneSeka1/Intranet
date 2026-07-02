import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator'

export class UpdateAnnouncementDto {
  @IsString() @IsOptional()
  title?: string

  @IsString() @IsOptional()
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
