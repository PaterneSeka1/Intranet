import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty()
  title!: string

  @IsString() @IsNotEmpty()
  body!: string

  @IsString() @IsOptional()
  businessUnitId?: string

  @IsBoolean() @IsOptional()
  isPinned?: boolean

  @IsBoolean() @IsOptional()
  isActive?: boolean

  @IsDateString() @IsOptional()
  publishedAt?: string

  @IsDateString() @IsOptional()
  expiresAt?: string
}
