import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  title!: string

  @IsString() @IsNotEmpty() @MaxLength(5000)
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
