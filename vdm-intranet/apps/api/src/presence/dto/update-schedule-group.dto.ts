import { IsString, IsOptional, IsBoolean, Matches, MaxLength } from 'class-validator'

export class UpdateScheduleGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime?: string

  @IsString()
  @IsOptional()
  businessUnitId?: string

  @IsString()
  @IsOptional()
  poleId?: string

  @IsBoolean()
  @IsOptional()
  isNightShift?: boolean

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
